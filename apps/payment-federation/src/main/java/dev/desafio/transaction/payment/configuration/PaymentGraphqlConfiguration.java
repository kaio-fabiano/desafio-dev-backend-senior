package dev.desafio.transaction.payment.configuration;

import org.springframework.boot.autoconfigure.graphql.GraphQlSourceBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.data.federation.FederationSchemaFactory;
import org.springframework.graphql.server.WebGraphQlInterceptor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration(proxyBeanMethods = false)
public class PaymentGraphqlConfiguration {
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
    WebGraphQlInterceptor propagatedPaymentIdentity(
        @org.springframework.beans.factory.annotation.Value(
            "${federation.internal-secret:federation-local-only}"
        )
        String internalSecret
    ) {
        return (request, chain) -> {
            var suppliedSecret = Optional.ofNullable(
                request.getHeaders().getFirst("x-federation-secret")
            ).orElse("");
            if (!MessageDigest.isEqual(
                suppliedSecret.getBytes(StandardCharsets.UTF_8),
                internalSecret.getBytes(StandardCharsets.UTF_8)
            )) {
                return reactor.core.publisher.Mono.error(
                    new IllegalStateException("Untrusted federation request")
                );
            }
            var subject = Optional.ofNullable(
                request.getHeaders().getFirst("x-authenticated-subject")
            ).orElse("");
            var scopes = scopes(request.getHeaders().getFirst("x-authenticated-scopes"));
            request.configureExecutionInput((input, builder) -> builder.graphQLContext(context -> context
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
