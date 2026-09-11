package dev.desafio.transaction.edge.configuration;

import dev.desafio.transaction.edge.OrderView;
import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import org.springframework.boot.autoconfigure.graphql.GraphQlSourceBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.data.federation.FederationSchemaFactory;
import org.springframework.graphql.execution.ClassNameTypeResolver;

@Configuration(proxyBeanMethods = false)
public class FederationGraphqlConfiguration {
    @Bean
    FederationSchemaFactory paymentFederationSchemaFactory() {
        var factory = new FederationSchemaFactory();
        var types = new ClassNameTypeResolver();
        types.addMapping(PaymentView.class, "Payment");
        types.addMapping(OrderView.class, "Order");
        types.addMapping(CheckoutOperationView.class, "CheckoutOperation");
        factory.setTypeResolver(types);
        return factory;
    }

    @Bean
    GraphQlSourceBuilderCustomizer paymentFederationCustomizer(FederationSchemaFactory factory) {
        return builder -> builder.schemaFactory(factory::createGraphQLSchema);
    }
}
