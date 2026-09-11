package dev.desafio.transaction.transaction.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.adapter.persistence.CheckoutOperationJpaRepository;
import dev.desafio.transaction.transaction.adapter.persistence.JpaCheckoutOperationRepository;
import dev.desafio.transaction.transaction.adapter.persistence.JpaTransactionOutbox;
import dev.desafio.transaction.transaction.adapter.persistence.JpaTransactionReadRepository;
import dev.desafio.transaction.transaction.adapter.persistence.JpaTransactionViewStore;
import dev.desafio.transaction.transaction.adapter.persistence.TransactionOutboxJpaRepository;
import dev.desafio.transaction.transaction.adapter.persistence.TransactionViewJpaRepository;
import dev.desafio.transaction.transaction.application.TransactionOutbox;
import dev.desafio.transaction.transaction.application.TransactionViewStore;
import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcomeHandler;
import dev.desafio.transaction.transaction.application.command.StartTransactionHandler;
import dev.desafio.transaction.transaction.application.event.TransactionEventHandler;
import dev.desafio.transaction.transaction.application.query.FindTransactionHandler;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.checkout.CheckoutService;
import dev.desafio.transaction.transaction.application.subscription.CheckoutOperationUpdatePublisher;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import dev.desafio.transaction.transaction.adapter.woocommerce.WooCommerceGraphQlOrderAdapter;
import dev.desafio.transaction.shared.infrastructure.messaging.ConfirmedAmqpPublisher;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelay;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelayScheduler;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.InboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaOutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.OutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpInboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpOutboxJpaRepository;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.axonframework.messaging.commandhandling.CommandMessage;
import org.axonframework.messaging.commandhandling.interception.CommandSequencingInterceptor;
import org.axonframework.messaging.core.sequencing.RoutingKeySequencingPolicy;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import jakarta.persistence.EntityManager;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
// Jpa adapters replace JdbcCheckoutOperationRepository and JdbcTransactionViewStore at runtime.
public class TransactionConfiguration {
    @Bean
    public CommandSequencingInterceptor<CommandMessage> commandSequencingInterceptor() {
        return new CommandSequencingInterceptor<>(RoutingKeySequencingPolicy.INSTANCE);
    }

    @Bean
    @ConditionalOnMissingBean(Clock.class)
    Clock transactionClock() {
        return Clock.systemUTC();
    }

    @Bean
    StartTransactionHandler startTransactionHandler(Clock clock) {
        return new StartTransactionHandler(clock);
    }

    @Bean
    RecordTransactionOutcomeHandler recordTransactionOutcomeHandler(Clock clock) {
        return new RecordTransactionOutcomeHandler(clock);
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    CheckoutOperationRepository checkoutOperationRepository(
        CheckoutOperationJpaRepository records,
        EntityManager entityManager,
        PlatformTransactionManager transactionManager,
        org.axonframework.messaging.eventhandling.gateway.EventGateway events
    ) {
        return new JpaCheckoutOperationRepository(records, entityManager, transactionManager, events);
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    TransactionViewStore transactionViewStore(
        TransactionViewJpaRepository records,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaTransactionViewStore(records, transactionManager);
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    TransactionOutbox transactionOutbox(
        ObjectMapper json,
        TransactionOutboxJpaRepository records,
        EntityManager entityManager,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaTransactionOutbox(json, records, entityManager, transactionManager);
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    TransactionReadRepository transactionReadRepository(
        CheckoutOperationJpaRepository checkouts,
        TransactionViewJpaRepository transactions
    ) {
        return new JpaTransactionReadRepository(checkouts, transactions);
    }

    @Bean("transactionOutboxRelay")
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    OutboxRelay transactionOutboxRelay(
        @Qualifier("transactionOutboxStore") OutboxStore outbox,
        ObjectMapper json,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        var codec = new IntegrationEventJson(json);
        return new OutboxRelay(
            outbox,
            new ConfirmedAmqpPublisher(rabbit, codec), codec, clock, "transaction-relay"
        );
    }

    @Bean("transactionInboxStore")
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    InboxStore transactionInboxStore(
        TransactionAmqpInboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        Clock clock,
        PlatformTransactionManager transactionManager
    ) {
        return JpaInboxStore.transaction(records, entityManager, json, clock, transactionManager);
    }

    @Bean("transactionOutboxStore")
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    OutboxStore transactionOutboxStore(
        TransactionAmqpOutboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        PlatformTransactionManager transactionManager
    ) {
        return JpaOutboxStore.transaction(records, entityManager, json, transactionManager);
    }

    @Bean("transactionReliableAmqpConsumer")
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    ReliableAmqpConsumer transactionReliableAmqpConsumer(
        @Qualifier("transactionInboxStore") InboxStore inbox,
        ObjectMapper json,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        return new ReliableAmqpConsumer(
            inbox, new IntegrationEventJson(json), new AmqpRetryRouter(rabbit, clock)
        );
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    OutboxRelayScheduler transactionOutboxRelayScheduler(
        @Qualifier("transactionOutboxRelay") OutboxRelay relay
    ) {
        return new OutboxRelayScheduler(relay);
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    TransactionEventHandler transactionEventHandler(TransactionViewStore views, TransactionOutbox outbox) {
        return new TransactionEventHandler(views, outbox);
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    FindTransactionHandler findTransactionHandler(TransactionViewStore views) {
        return new FindTransactionHandler(views);
    }

    @Bean
    @ConditionalOnProperty(name = {
        "transaction.checkout.wordpress-url",
        "transaction.checkout.site-token"
    })
    WooCommerceOrderPort wooCommerceOrderPort(
        @Value("${transaction.checkout.wordpress-url}") URI wordpress,
        @Value("${transaction.checkout.service-identity:payment-federation}") String serviceIdentity,
        @Value("${transaction.checkout.site-token}") String siteToken,
        ObjectMapper json
    ) {
        return WooCommerceGraphQlOrderAdapter.connect(wordpress, serviceIdentity, siteToken, json);
    }

    @Bean
    @ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
    @ConditionalOnProperty(name = {
        "transaction.checkout.wordpress-url",
        "transaction.checkout.site-token"
    })
    CheckoutService checkoutService(
        CheckoutOperationRepository operations,
        WooCommerceOrderPort woo,
        CommandGateway commands,
        Clock clock
    ) {
        return new CheckoutService(
            operations,
            woo,
            command -> commands.send(command, String.class),
            clock
        );
    }
}
