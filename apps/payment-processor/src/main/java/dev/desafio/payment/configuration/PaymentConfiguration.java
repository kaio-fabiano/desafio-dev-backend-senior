package dev.desafio.payment.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.payment.adapter.persistence.PaymentRepository;
import dev.desafio.payment.application.PaymentHandler;
import dev.desafio.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.payment.application.command.OrderPaymentPort;
import dev.desafio.payment.application.query.FindPaymentHandler;
import dev.desafio.payment.application.query.PaymentView;
import dev.desafio.payment.domain.Payment;
import dev.desafio.payment.inventory.InventoryRepository;
import dev.desafio.payment.inventory.InventoryService;
import dev.desafio.payment.inventory.WooInventoryAdapter;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    @ConditionalOnProperty(name = "spring.datasource.url")
    InventoryRepository inventoryRepository(DataSource dataSource) {
        return new InventoryRepository.Jdbc(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = {"spring.datasource.url", "wordpress.graphql-url"})
    WooInventoryAdapter wooInventoryAdapter(ObjectMapper json) {
        return new WooInventoryAdapter(
            URI.create(requiredEnvironment("WORDPRESS_GRAPHQL_URL")),
            json
        );
    }

    @Bean
    @ConditionalOnProperty(name = {"spring.datasource.url", "wordpress.graphql-url"})
    InventoryService inventoryService(InventoryRepository repository, WooInventoryAdapter stock) {
        return new InventoryService(repository, stock);
    }

    @Bean
    @ConditionalOnBean(PaymentHandler.class)
    AuthorizePaymentHandler authorizePaymentHandler(PaymentHandler paymentHandler, Optional<OrderPaymentPort> orders) {
        return orders.map(orderPort -> new AuthorizePaymentHandler(paymentHandler, orderPort))
            .orElseGet(() -> new AuthorizePaymentHandler(paymentHandler));
    }

    @Bean
    @ConditionalOnProperty(name = "wordpress.graphql-url")
    OrderPaymentPort wooCommerceOrderPayment(ObjectMapper json) {
        var endpoint = URI.create(requiredEnvironment("WORDPRESS_GRAPHQL_URL"));
        var client = HttpClient.newHttpClient();
        return (command, payment) -> {
            var input = new LinkedHashMap<String, Object>();
            input.put("clientMutationId", command.operationKey());
            input.put("id", command.orderId());
            var metadata = new ArrayList<>(List.of(Map.of("key", "operation_key", "value", command.operationKey())));
            if (payment.method() == Payment.Method.CARD) {
                input.put("status", "COMPLETED");
                input.put("isPaid", true);
                input.put("transactionId", payment.id().toString());
            } else {
                metadata.add(Map.of("key", "payment_state", "value", "PIX_GENERATED"));
                metadata.add(Map.of("key", "pix_code", "value", payment.pixCode()));
            }
            input.put("metaData", metadata);
            var operation = Map.of(
                "operationName", "UpdateOrderPayment",
                "query", "mutation UpdateOrderPayment($input: UpdateOrderInput!) { updateOrder(input: $input) { order { id status transactionId } } }",
                "variables", Map.of("input", input)
            );
            final String body;
            try {
                body = json.writeValueAsString(operation);
            } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
                throw new IllegalStateException("WordPress federation payment request could not be serialized", exception);
            }
            var request = HttpRequest.newBuilder(endpoint)
                .header("Content-Type", "application/json")
                .header("X-Authenticated-Subject", "payment-federation")
                .header("X-Authenticated-Scopes", "orders:write")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
            try {
                var response = client.send(request, HttpResponse.BodyHandlers.ofString());
                var payload = json.readTree(response.body());
                if (response.statusCode() < 200 || response.statusCode() >= 300 || !payload.path("errors").isMissingNode()) {
                    throw new IllegalStateException("WordPress federation payment update failed: " + response.statusCode());
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("WordPress federation payment update interrupted", exception);
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("WordPress federation payment update failed", exception);
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

}
