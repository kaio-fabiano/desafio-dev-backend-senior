package dev.desafio.payment;

import dev.desafio.payment.application.PaymentHandler;
import dev.desafio.payment.application.PaymentRepository;
import dev.desafio.payment.application.command.AuthorizePayment;
import dev.desafio.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.payment.application.query.FindPayment;
import dev.desafio.payment.application.query.FindPaymentHandler;
import dev.desafio.payment.application.query.PaymentView;
import dev.desafio.payment.configuration.PaymentConfiguration;
import dev.desafio.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringBootTest(
    webEnvironment = WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude="
            + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        "management.health.rabbit.enabled=false"
    }
)
class PaymentFederationTest {
    private static final PaymentView CARD_VIEW = new PaymentView(
        "payment-99", "operation-99", "order-99", Payment.Method.CARD,
        new BigDecimal("149.90"), "BRL", Payment.Status.AUTHORIZED, null
    );

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private AuthorizePaymentHandler authorizePaymentHandler;

    @MockitoBean
    private FindPaymentHandler findPaymentHandler;

    @Test
    @DisplayName("AC-099: Spring serves Payment query, mutation, and entity federation fields @spec:AC-099")
    void servesFederatedPaymentSchema() {
        when(authorizePaymentHandler.handle(any())).thenReturn(CARD_VIEW);
        when(findPaymentHandler.handle(new FindPayment("payment-99"))).thenReturn(Optional.of(CARD_VIEW));

        var service = graphQl("{ _service { sdl } }", null, null);
        var sdl = nested(nested(service, "data"), "_service", "sdl").toString();
        assertTrue(sdl.contains("type Payment"));
        assertTrue(sdl.contains("@key"));
        assertTrue(sdl.contains("authorizePayment"));

        var mutation = graphQl("""
            mutation {
              authorizePayment(input: {
                operationKey: "operation-99"
                paymentId: "payment-99"
                orderId: "order-99"
                method: CARD
                amount: 149.90
                currency: "BRL"
              }) { id status }
            }
            """, "buyer-99", "cart:write");
        assertEquals("payment-99", nested(nested(mutation, "data"), "authorizePayment", "id"));

        var query = graphQl("{ payment(id: \"payment-99\") { id status } }", "buyer-99", "orders:read");
        assertEquals("AUTHORIZED", nested(nested(query, "data"), "payment", "status"));

        var entity = graphQl("""
            query {
              _entities(representations: [{__typename: "Payment", id: "payment-99"}]) {
                ... on Payment { id operationKey }
              }
            }
            """, "buyer-99", "orders:read");
        assertNull(entity.get("errors"), entity.toString());
        var entities = (java.util.List<?>) nested(entity, "data").get("_entities");
        assertEquals("operation-99", ((Map<?, ?>) entities.getFirst()).get("operationKey"));
    }

    @Test
    @DisplayName("AC-124: Payment rejects forged federation identity headers @spec:AC-124")
    void rejectsUntrustedFederationHeaders() {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-authenticated-subject", "attacker");
        headers.set("x-authenticated-scopes", "orders:read cart:write");
        var response = restTemplate.exchange(
            "/graphql",
            HttpMethod.POST,
            new HttpEntity<>(Map.of("query", "{ payment(id: \"payment-99\") { id } }"), headers),
            new ParameterizedTypeReference<Map<String, Object>>() {}
        );

        assertTrue(response.getStatusCode().isError());
        verifyNoInteractions(authorizePaymentHandler, findPaymentHandler);
    }

    @Test
    @DisplayName("AC-100: command and query handlers keep write and read paths explicit @spec:AC-100")
    void separatesAggregateWritesFromPaymentViews() {
        var repository = new IdempotentRepository();
        var commandHandler = new AuthorizePaymentHandler(new PaymentHandler(repository, dev.desafio.payment.application.PaymentProvider.deterministic()));

        assertThrows(IllegalArgumentException.class, () -> commandHandler.handle(new AuthorizePayment(
            "operation-invalid", "payment-invalid", "order-invalid", Payment.Method.CARD,
            BigDecimal.ZERO, "BRL"
        )));

        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:payment-view;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        var jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
            create table payment_record (
                payment_id varchar primary key, operation_key varchar, order_id varchar,
                method varchar, amount numeric, currency varchar, status varchar, pix_code varchar
            )
            """);
        jdbc.update("""
            insert into payment_record
                (payment_id, operation_key, order_id, method, amount, currency, status, pix_code)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """, "payment-view", "operation-view", "order-view", "CARD",
            new BigDecimal("42.50"), "BRL", "AUTHORIZED", null);

        var view = new PaymentConfiguration().findPaymentHandler(jdbc).handle(new FindPayment("payment-view"));

        assertEquals("order-view", view.orElseThrow().orderId());
        assertEquals(0, new BigDecimal("42.50").compareTo(view.orElseThrow().amount()));
        assertEquals(0, repository.effectCount());
    }

    @Test
    @DisplayName("AC-101: concurrent authorization and repeated Pix or compensation remain idempotent @spec:AC-101")
    void keepsEveryPaymentDeliveryIdempotent() throws Exception {
        var repository = new IdempotentRepository();
        var paymentHandler = new PaymentHandler(repository, dev.desafio.payment.application.PaymentProvider.deterministic());
        var authorization = new AuthorizePaymentHandler(paymentHandler);
        var card = new AuthorizePayment(
            "operation-card", "payment-card", "order-card", Payment.Method.CARD,
            new BigDecimal("31.00"), "BRL"
        );

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> authorization.handle(card));
            var second = executor.submit(() -> authorization.handle(card));
            assertEquals(first.get(), second.get());
        }

        var pix = new AuthorizePayment(
            "operation-pix", "payment-pix", "order-pix", Payment.Method.PIX,
            new BigDecimal("82.50"), "BRL"
        );
        assertEquals(authorization.handle(pix), authorization.handle(pix));

        var refund = new Payment.RefundRequested(
            "operation-card", "payment-card", "order-card", "INSUFFICIENT_STOCK"
        );
        var firstRefund = paymentHandler.handle(UUID.randomUUID(), refund);
        var repeatedRefund = paymentHandler.handle(UUID.randomUUID(), refund);

        assertEquals(firstRefund.payment(), repeatedRefund.payment());
        assertEquals(firstRefund.outgoingEvent(), repeatedRefund.outgoingEvent());
        assertEquals(3, repository.effectCount());
    }

    @Test
    @DisplayName("AC-096: Payment rejects absent identity and missing operation scopes @spec:AC-096")
    void enforcesAuthorizationInsideThePaymentSubgraph() {
        var missingIdentity = graphQl("{ payment(id: \"payment-99\") { id } }", null, "orders:read");
        var missingReadScope = graphQl("{ payment(id: \"payment-99\") { id } }", "buyer-99", "marketplace:read");
        var missingWriteScope = graphQl("""
            mutation {
              authorizePayment(input: {
                operationKey: "operation-99", paymentId: "payment-99", orderId: "order-99",
                method: CARD, amount: 149.90, currency: "BRL"
              }) { id }
            }
            """, "buyer-99", "orders:read");

        assertNotNull(missingIdentity.get("errors"));
        assertNotNull(missingReadScope.get("errors"));
        assertNotNull(missingWriteScope.get("errors"));
        verifyNoInteractions(authorizePaymentHandler, findPaymentHandler);
    }

    private Map<String, Object> graphQl(String query, String subject, String scopes) {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-federation-secret", "federation-local-only");
        if (subject != null) headers.set("x-authenticated-subject", subject);
        if (scopes != null) headers.set("x-authenticated-scopes", scopes);
        var response = restTemplate.exchange(
            "/graphql",
            HttpMethod.POST,
            new HttpEntity<>(Map.of("query", query), headers),
            new ParameterizedTypeReference<Map<String, Object>>() {}
        );
        assertTrue(response.getStatusCode().is2xxSuccessful());
        return Optional.ofNullable(response.getBody()).orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> nested(Map<?, ?> source, String key) {
        return (Map<String, Object>) source.get(key);
    }

    private static Object nested(Map<?, ?> source, String first, String second) {
        return nested(source, first).get(second);
    }

    private static final class IdempotentRepository implements PaymentRepository {
        private static final Instant NOW = Instant.parse("2026-08-28T12:00:00Z");
        private final Map<String, Payment> payments = new HashMap<>();
        private final Map<String, ProcessingResult> effects = new HashMap<>();

        @Override
        public synchronized ProcessingResult process(UUID eventId, Payment.Command command, Instant occurredAt) {
            if (command instanceof Payment.PaymentRequested requested) {
                var proposed = Payment.start(requested);
                var payment = payments.computeIfAbsent(command.operationKey(), ignored -> proposed);
                if (!payment.hasSameIdentity(proposed)) throw new IllegalArgumentException("conflicting payment");
                var effect = requested.method() == Payment.Method.CARD ? "AUTHORIZATION" : "PIX";
                var status = requested.method() == Payment.Method.CARD
                    ? Payment.Status.AUTHORIZED : Payment.Status.PIX_GENERATED;
                return effects.computeIfAbsent(effect + ':' + payment.paymentId(), ignored -> result(payment, status));
            }

            var refund = (Payment.RefundRequested) command;
            var payment = Optional.ofNullable(payments.get(command.operationKey()))
                .orElseThrow(() -> new IllegalStateException("payment not found"))
                .refund(refund);
            payments.put(command.operationKey(), payment);
            return effects.computeIfAbsent("REFUND:" + payment.paymentId(), ignored -> result(payment, Payment.Status.REFUNDED));
        }

        private ProcessingResult result(Payment payment, Payment.Status status) {
            return new ProcessingResult(payment, Payment.resultEvent(payment, status, NOW), false);
        }

        int effectCount() {
            return effects.size();
        }
    }
}
