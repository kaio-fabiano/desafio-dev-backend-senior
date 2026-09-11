package dev.desafio.transaction.payment.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.payment.adapter.messaging.AxonPaymentRabbitListener;
import dev.desafio.transaction.payment.adapter.messaging.OutboxPaymentIntegrationEventPublisher;
import dev.desafio.transaction.payment.application.command.PaymentCommandHandler;
import dev.desafio.transaction.payment.application.event.PaymentProviderEffectHandler;
import dev.desafio.transaction.payment.adapter.axon.AxonProviderNotificationHandler;
import dev.desafio.transaction.payment.adapter.persistence.JpaPaymentEffectLedger;
import dev.desafio.transaction.payment.adapter.persistence.JpaPaymentProjection;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentEffectRepository;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentRecordRepository;
import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentIntegrationEventPublisher;
import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.application.event.PaymentIntegrationEventHandler;
import dev.desafio.transaction.payment.application.event.PaymentProjectionHandler;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.ConfirmedAmqpPublisher;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelay;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelayScheduler;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.InboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaOutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.OutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.PaymentAmqpInboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.PaymentAmqpOutboxJpaRepository;
import jakarta.persistence.EntityManager;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;

@Configuration(proxyBeanMethods = false)
@ConditionalOnExpression("'${spring.datasource.url:}' matches '^jdbc:postgresql:.*'")
public class AxonPaymentMessagingConfiguration {
    static final String PAYMENT_QUEUE = "payment.events.v1";

    @Bean
    PaymentCommandHandler paymentCommandHandler(Clock clock) {
        return new PaymentCommandHandler(clock);
    }

    @Bean
    PaymentEffectLedger paymentEffectLedger(
        SpringDataPaymentEffectRepository effects,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaPaymentEffectLedger(effects, transactionManager);
    }

    @Bean
    PaymentProjection paymentProjection(SpringDataPaymentRecordRepository payments) {
        return new JpaPaymentProjection(payments);
    }

    @Bean("paymentInboxStore")
    InboxStore paymentInboxStore(
        PaymentAmqpInboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        Clock clock,
        PlatformTransactionManager transactionManager
    ) {
        return JpaInboxStore.payment(records, entityManager, json, clock, transactionManager);
    }

    @Bean("paymentOutboxStore")
    OutboxStore paymentOutboxStore(
        PaymentAmqpOutboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        PlatformTransactionManager transactionManager
    ) {
        return JpaOutboxStore.payment(records, entityManager, json, transactionManager);
    }

    @Bean
    PaymentIntegrationEventPublisher paymentIntegrationEventPublisher(
        @Qualifier("paymentOutboxStore") OutboxStore outbox,
        ObjectMapper json
    ) {
        return new OutboxPaymentIntegrationEventPublisher(outbox, json);
    }

    @Bean("paymentOutboxRelay")
    OutboxRelay paymentOutboxRelay(
        @Qualifier("paymentOutboxStore") OutboxStore outbox,
        ObjectMapper json,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        var codec = new IntegrationEventJson(json);
        return new OutboxRelay(
            outbox,
            new ConfirmedAmqpPublisher(rabbit, codec), codec, clock, "payment-relay"
        );
    }

    @Bean
    OutboxRelayScheduler paymentOutboxRelayScheduler(
        @Qualifier("paymentOutboxRelay") OutboxRelay relay
    ) {
        return new OutboxRelayScheduler(relay);
    }

    @Bean
    PaymentProviderEffectHandler paymentProviderEffectHandler(
        PaymentEffectLedger effects,
        PaymentProvider provider,
        CommandGateway commands,
        Clock clock
    ) {
        return new PaymentProviderEffectHandler(effects, provider, commands, clock);
    }

    @Bean
    AxonProviderNotificationHandler axonProviderNotificationHandler(
        PaymentProvider provider,
        ProviderNotificationHandler.Repository notifications,
        CommandGateway commands,
        Clock clock
    ) {
        return new AxonProviderNotificationHandler(provider, notifications, commands, clock);
    }

    @Bean
    PaymentProjectionHandler paymentProjectionHandler(PaymentProjection projection) {
        return new PaymentProjectionHandler(projection);
    }

    @Bean
    PaymentIntegrationEventHandler paymentIntegrationEventHandler(
        PaymentIntegrationEventPublisher publisher
    ) {
        return new PaymentIntegrationEventHandler(publisher);
    }

    @Bean
    ReliableAmqpConsumer paymentReliableAmqpConsumer(
        @Qualifier("paymentInboxStore") InboxStore inbox,
        ObjectMapper json,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        return new ReliableAmqpConsumer(
            inbox, new IntegrationEventJson(json), new AmqpRetryRouter(rabbit, clock)
        );
    }

    @Bean
    AxonPaymentRabbitListener axonPaymentRabbitListener(
        @Qualifier("paymentReliableAmqpConsumer") ReliableAmqpConsumer consumer,
        CommandGateway commands
    ) {
        return new AxonPaymentRabbitListener(consumer, commands);
    }
}
