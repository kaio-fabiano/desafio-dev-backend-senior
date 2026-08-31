package dev.desafio.payment.configuration;

import dev.desafio.payment.adapter.persistence.PaymentRepository;
import dev.desafio.payment.application.PaymentHandler;
import dev.desafio.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.payment.application.command.OrderPaymentPort;
import dev.desafio.payment.application.query.FindPaymentHandler;
import dev.desafio.payment.application.query.PaymentView;
import dev.desafio.payment.domain.Payment;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.graphql.GraphQlSourceBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.data.federation.FederationSchemaFactory;
import org.springframework.graphql.server.WebGraphQlInterceptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Arrays;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;

@Configuration(proxyBeanMethods = false)
public class PaymentConfiguration {
    private static final String FIND_PAYMENT_SQL = """
        select payment_id, operation_key, order_id, method, amount, currency, status, pix_code
          from payment_record
         where payment_id = ?
        """;

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    PaymentRepository paymentRepository(DataSource dataSource) {
        return new PaymentRepository.Jdbc(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    PaymentHandler paymentHandler(PaymentRepository repository) {
        return new PaymentHandler(repository);
    }

    @Bean
    @ConditionalOnBean(PaymentHandler.class)
    AuthorizePaymentHandler authorizePaymentHandler(PaymentHandler paymentHandler, Optional<OrderPaymentPort> orders) {
        return orders.map(orderPort -> new AuthorizePaymentHandler(paymentHandler, orderPort))
            .orElseGet(() -> new AuthorizePaymentHandler(paymentHandler));
    }

    @Bean
    @ConditionalOnProperty(name = "wordpress.url")
    OrderPaymentPort wooCommerceOrderPayment() {
        var endpoint = requiredEnvironment("WORDPRESS_URL");
        var credentials = Base64.getEncoder().encodeToString((
            requiredEnvironment("WOO_CONSUMER_KEY") + ":" + requiredEnvironment("WOO_CONSUMER_SECRET")
        ).getBytes(StandardCharsets.UTF_8));
        var client = HttpClient.newHttpClient();
        return (command, payment) -> {
            var metadata = "\"meta_data\":[{\"key\":\"operation_key\",\"value\":\"" + json(command.operationKey()) + "\"}";
            var body = payment.method() == Payment.Method.CARD
                ? "{\"status\":\"completed\",\"set_paid\":true,\"transaction_id\":\"" + json(payment.id()) + "\"," + metadata + "]}"
                : "{" + metadata + ",{\"key\":\"payment_state\",\"value\":\"PIX_GENERATED\"},{\"key\":\"pix_code\",\"value\":\"" + json(payment.pixCode()) + "\"}]}";
            var request = HttpRequest.newBuilder(URI.create(endpoint + "/wp-json/wc/v3/orders/" + command.orderId()))
                .header("Authorization", "Basic " + credentials)
                .header("Content-Type", "application/json")
                .header("X-Forwarded-Proto", "https")
                .PUT(HttpRequest.BodyPublishers.ofString(body))
                .build();
            try {
                var response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IllegalStateException("WooCommerce order update failed: " + response.statusCode());
                }
                deliverLocalWebhook(client, response.body());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("WooCommerce order update interrupted", exception);
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("WooCommerce order update failed", exception);
            }
        };
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    public FindPaymentHandler findPaymentHandler(JdbcTemplate jdbcTemplate) {
        return new FindPaymentHandler(paymentId -> jdbcTemplate.query(
            FIND_PAYMENT_SQL,
            (row, index) -> new PaymentView(
                row.getString("payment_id"), row.getString("operation_key"), row.getString("order_id"),
                Payment.Method.valueOf(row.getString("method")), row.getBigDecimal("amount"),
                row.getString("currency"), Payment.Status.valueOf(row.getString("status")),
                row.getString("pix_code")
            ),
            paymentId
        ).stream().findFirst());
    }

    @Bean
    FederationSchemaFactory paymentFederationSchemaFactory() {
        var factory = new FederationSchemaFactory();
        factory.setTypeResolver(environment -> environment.getSchema().getObjectType("Payment"));
        return factory;
    }

    @Bean
    GraphQlSourceBuilderCustomizer paymentFederationCustomizer(FederationSchemaFactory factory) {
        return builder -> builder.schemaFactory(factory::createGraphQLSchema);
    }

    @Bean
    WebGraphQlInterceptor propagatedPaymentIdentity() {
        return (request, chain) -> {
            var subject = Optional.ofNullable(request.getHeaders().getFirst("x-authenticated-subject"))
                .orElse("");
            var scopes = scopes(request.getHeaders().getFirst("x-authenticated-scopes"));
            request.configureExecutionInput((input, builder) -> builder.graphQLContext(contextBuilder -> contextBuilder
                .of("paymentSubject", subject)
                .of("paymentScopes", scopes)
            ).build());
            return chain.next(request);
        };
    }

    private Set<String> scopes(String header) {
        if (header == null || header.isBlank()) return Set.of();
        return Arrays.stream(header.trim().split("\\s+"))
            .filter(scope -> !scope.isBlank())
            .collect(Collectors.toUnmodifiableSet());
    }

    private static String requiredEnvironment(String name) {
        var value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException(name + " is required");
        return value;
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void deliverLocalWebhook(HttpClient client, String body) throws java.io.IOException, InterruptedException {
        var url = System.getenv("WOO_WEBHOOK_DELIVERY_URL");
        var secret = System.getenv("WOO_WEBHOOK_SECRET");
        if (url == null || url.isBlank() || secret == null || secret.isBlank()) return;
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            var signature = Base64.getEncoder().encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
            var response = client.send(
                HttpRequest.newBuilder(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("X-WC-Webhook-Signature", signature)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build(),
                HttpResponse.BodyHandlers.discarding()
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Local webhook delivery failed: " + response.statusCode());
            }
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Webhook signature failed", exception);
        }
    }
}
