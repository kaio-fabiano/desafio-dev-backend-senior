package dev.desafio.transaction.shared.interfaces.graphql;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.graphql.data.federation.FederationSchemaFactory;
import org.springframework.stereotype.Component;

@Component
public final class FederationEntityTypeResolver implements BeanPostProcessor {
    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof FederationSchemaFactory factory) {
            factory.setTypeResolver(environment -> {
                var object = environment.getObject();
                var type = object instanceof OrderView ? "Order"
                    : object instanceof CheckoutOperationView ? "CheckoutOperation"
                    : "Payment";
                return environment.getSchema().getObjectType(type);
            });
        }
        return bean;
    }
}
