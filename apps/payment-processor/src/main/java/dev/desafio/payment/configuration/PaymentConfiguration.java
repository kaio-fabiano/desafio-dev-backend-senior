package dev.desafio.payment.configuration;

import dev.desafio.payment.application.PaymentHandler;
import dev.desafio.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.payment.application.query.FindPaymentHandler;
import dev.desafio.payment.application.query.PaymentView;
import dev.desafio.payment.domain.Payment;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.graphql.GraphQlSourceBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.data.federation.FederationSchemaFactory;
import org.springframework.graphql.server.WebGraphQlInterceptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration(proxyBeanMethods = false)
public class PaymentConfiguration {
    private static final String FIND_PAYMENT_SQL = """
        select payment_id, operation_key, order_id, method, amount, currency, status, pix_code
          from payment_record
         where payment_id = ?
        """;

    @Bean
    @ConditionalOnBean(PaymentHandler.class)
    AuthorizePaymentHandler authorizePaymentHandler(PaymentHandler paymentHandler) {
        return new AuthorizePaymentHandler(paymentHandler);
    }

    @Bean
    @ConditionalOnBean(JdbcTemplate.class)
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
}
