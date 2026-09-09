package dev.desafio.transaction.transaction.interfaces.graphql;

import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.application.subscription.OnTransactionUpdatedHandler;
import dev.desafio.transaction.transaction.application.subscription.TransactionSubscriptionEventHandler;
import dev.desafio.transaction.transaction.application.subscription.TransactionSubscriptionGateway;
import org.axonframework.extension.reactor.messaging.queryhandling.gateway.ReactorQueryGateway;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Optional;

@Configuration(proxyBeanMethods = false)
class TransactionSubscriptionConfiguration {
    @Bean
    TransactionSubscriptionGateway transactionSubscriptionGateway(ReactorQueryGateway queries) {
        return query -> queries.subscriptionQuery(query, TransactionView.class);
    }

    @Bean
    OnTransactionUpdatedHandler onTransactionUpdatedHandler(
        TransactionSubscriptionGateway subscriptions,
        Optional<TransactionReadRepository> views
    ) {
        return new OnTransactionUpdatedHandler(subscriptions, views);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    TransactionSubscriptionEventHandler transactionSubscriptionEventHandler() {
        return new TransactionSubscriptionEventHandler();
    }
}
