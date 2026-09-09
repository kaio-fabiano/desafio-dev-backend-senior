package dev.desafio.transaction.graphql;

import dev.desafio.transaction.inventory.application.query.FindInventoryReservationByTransaction;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import dev.desafio.transaction.payment.application.query.FindPaymentByTransaction;
import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.FindCheckoutOperation;
import dev.desafio.transaction.transaction.application.query.FindOwnedTransaction;
import dev.desafio.transaction.transaction.application.query.FindTransactionByWooOrder;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.checkout.CheckoutCommand;
import dev.desafio.transaction.transaction.checkout.CheckoutResult;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.extension.reactor.messaging.commandhandling.gateway.ReactorCommandGateway;
import org.axonframework.extension.reactor.messaging.queryhandling.gateway.ReactorQueryGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import reactor.core.publisher.Mono;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude="
            + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        "management.health.rabbit.enabled=false"
    }
)
class OrderWorkflowGraphQlCompatibilityTest {
    private static final TransactionView TRANSACTION = new TransactionView(
        "transaction-249", "operation-249", "buyer-249", "42",
        new BigDecimal("19.90"), "BRL", "PIX", Transaction.Status.PAYMENT_PENDING,
        "provider-249", 3
    );
    private static final PaymentView PAYMENT = new PaymentView(
        "payment-249", "operation-249", "transaction-249", Payment.Method.PIX,
        new BigDecimal("19.90"), "BRL", Payment.Status.PIX_GENERATED,
        "provider-249", "pix-code-249"
    );
    private static final InventoryReservationView INVENTORY = new InventoryReservationView(
        "reservation-249", "transaction-249", "42", InventoryReservation.Status.RESERVED,
        1, null, Instant.parse("2026-09-09T12:00:00Z")
    );

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private ReactorCommandGateway commandGateway;

    @MockitoBean
    private ReactorQueryGateway queryGateway;

    private final Map<String, BearerClaims> tokens = new ConcurrentHashMap<>();
    private final AtomicInteger tokenSequence = new AtomicInteger();

    @BeforeEach
    void acceptTestTokens() {
        tokens.clear();
        when(jwtDecoder.decode(anyString())).thenAnswer(invocation -> {
            var claims = tokens.get(invocation.<String>getArgument(0));
            if (claims == null) throw new org.springframework.security.oauth2.jwt.BadJwtException("invalid token");
            var now = Instant.now();
            return Jwt.withTokenValue(invocation.getArgument(0))
                .header("alg", "RS256")
                .subject(claims.subject())
                .claim("scope", claims.scopes())
                .issuedAt(now.minusSeconds(1))
                .expiresAt(now.plusSeconds(60))
                .build();
        });
        when(commandGateway.send(any(CheckoutCommand.class), eq(CheckoutResult.class)))
            .thenReturn(Mono.just(new CheckoutResult("transaction-249", "42")));
        when(queryGateway.query(any(FindOwnedTransaction.class), eq(TransactionView.class)))
            .thenReturn(Mono.just(TRANSACTION));
        when(queryGateway.query(any(FindTransactionByWooOrder.class), eq(TransactionView.class)))
            .thenReturn(Mono.just(TRANSACTION));
        when(queryGateway.query(any(FindCheckoutOperation.class), eq(CheckoutOperationView.class)))
            .thenReturn(Mono.just(new CheckoutOperationView(
                "transaction-249", "operation-249", "COMPLETED"
            )));
        when(queryGateway.query(any(FindPaymentByTransaction.class), eq(PaymentView.class)))
            .thenReturn(Mono.just(PAYMENT));
        when(queryGateway.query(
            any(FindInventoryReservationByTransaction.class), eq(InventoryReservationView.class)
        )).thenReturn(Mono.just(INVENTORY));
    }

    @Test
    @DisplayName("The Java HTTP endpoint preserves the Order Workflow GraphQL contract @spec:AC-288")
    void javaHttpEndpointPreservesOrderWorkflowGraphQlContract() {
        var response = graphQl("{ _service { sdl } }", "buyer-249", "orders:read cart:write");
        var sdl = nested(nested(response, "data"), "_service").get("sdl").toString();

        assertTrue(sdl.contains("startCheckout"), sdl);
        assertTrue(sdl.contains("checkout("), sdl);
        assertTrue(sdl.contains("type Order"), sdl);
        assertTrue(sdl.contains("workflow: OrderWorkflow!"), sdl);

        var checkout = graphQl(
            "{ checkout(id: \"transaction-249\") { id operationKey status } }",
            "buyer-249", "orders:read"
        );
        assertEquals("COMPLETED", nested(nested(checkout, "data"), "checkout").get("status"));

        var mutation = graphQl("""
            mutation {
              startCheckout(input: {
                operationKey: "operation-249"
                paymentMethod: PIX
                payerEmail: "buyer@example.test"
              }) {
                id wooOrderId paymentMethod pixCode workflow { state }
              }
            }
            """, "buyer-249", "cart:write", Map.of(
                "cart-token", "cart-249",
                "woocommerce-session", "woo-session-249",
                "cookie", "session=249"
            ));
        var order = nested(nested(mutation, "data"), "startCheckout");
        assertEquals("42", order.get("wooOrderId"));
        assertEquals("PIX", order.get("paymentMethod"));
        assertEquals("pix-code-249", order.get("pixCode"));
        assertEquals("PIX_GENERATED", nested(order, "workflow").get("state"));

        var entity = graphQl("""
            query {
              _entities(representations: [{__typename: "Order", id: "cG9zdDo0Mg=="}]) {
                ... on Order { id wooOrderId workflow { state } }
              }
            }
            """, "buyer-249", "orders:read");
        assertNull(entity.get("errors"), entity.toString());
        var entities = (List<?>) nested(entity, "data").get("_entities");
        assertEquals("42", ((Map<?, ?>) entities.getFirst()).get("wooOrderId"));

        var command = org.mockito.ArgumentCaptor.forClass(CheckoutCommand.class);
        verify(commandGateway).send(command.capture(), eq(CheckoutResult.class));
        assertEquals("buyer-249", command.getValue().subject());
        assertEquals("cart-249", command.getValue().session().cartToken());
        verify(queryGateway).query(
            new FindCheckoutOperation("transaction-249", "buyer-249"),
            CheckoutOperationView.class
        );
        verify(queryGateway).query(
            new FindTransactionByWooOrder("42", "buyer-249"), TransactionView.class
        );
    }

    @Test
    @DisplayName("Order Workflow GraphQL preserves scopes, owner isolation, validation, and errors @spec:AC-288")
    void preservesAuthorizationAndValidationErrors() {
        var forbidden = graphQl(
            "{ checkout(id: \"transaction-249\") { id } }",
            "buyer-249", "cart:write"
        );
        assertEquals("FORBIDDEN", errorCode(forbidden));

        var invalid = graphQl("""
            mutation {
              startCheckout(input: {
                operationKey: "operation-249"
                paymentMethod: CARD
                payerEmail: "buyer@example.test"
              }) { id }
            }
            """, "buyer-249", "cart:write");
        assertEquals("CHECKOUT_INPUT_INVALID", errorCode(invalid));

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth("forged");
        var unauthorized = restTemplate.exchange(
            "/graphql", HttpMethod.POST,
            new HttpEntity<>(Map.of("query", "{ checkout(id: \"transaction-249\") { id } }"), headers),
            new ParameterizedTypeReference<Map<String, Object>>() {}
        );
        assertEquals(401, unauthorized.getStatusCode().value());
    }

    private Map<String, Object> graphQl(String query, String subject, String scopes) {
        return graphQl(query, subject, scopes, Map.of());
    }

    private Map<String, Object> graphQl(
        String query,
        String subject,
        String scopes,
        Map<String, String> requestHeaders
    ) {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token(subject, scopes));
        requestHeaders.forEach(headers::set);
        var response = restTemplate.exchange(
            "/graphql",
            HttpMethod.POST,
            new HttpEntity<>(Map.of("query", query), headers),
            new ParameterizedTypeReference<Map<String, Object>>() {}
        );
        assertTrue(response.getStatusCode().is2xxSuccessful());
        return response.getBody();
    }

    private String token(String subject, String scopes) {
        var token = "order-workflow-test-token-" + tokenSequence.incrementAndGet();
        tokens.put(token, new BearerClaims(subject, scopes));
        return token;
    }

    @SuppressWarnings("unchecked")
    private static String errorCode(Map<String, Object> response) {
        var errors = (List<Map<String, Object>>) response.get("errors");
        return nested(errors.getFirst(), "extensions").get("code").toString();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> nested(Map<?, ?> source, String key) {
        return (Map<String, Object>) source.get(key);
    }

    private record BearerClaims(String subject, String scopes) {}
}
