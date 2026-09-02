package dev.desafio.transaction.payment.configuration;

import org.springframework.boot.autoconfigure.graphql.GraphQlSourceBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.data.federation.FederationSchemaFactory;

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
}
