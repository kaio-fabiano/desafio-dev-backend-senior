package dev.desafio.transaction.payment.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.payment.adapter.messaging.AxonPaymentRabbitListener;
import dev.desafio.transaction.payment.adapter.messaging.JdbcPaymentIntegrationEventPublisher;
import dev.desafio.transaction.payment.adapter.axon.PaymentCommandHandler;
import dev.desafio.transaction.payment.adapter.axon.PaymentProviderEffectHandler;
import dev.desafio.transaction.payment.adapter.axon.AxonProviderNotificationHandler;
import dev.desafio.transaction.payment.adapter.persistence.JdbcPaymentEffectLedger;
import dev.desafio.transaction.payment.adapter.persistence.JdbcPaymentProjection;
import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentIntegrationEventPublisher;
import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.application.axon.PaymentIntegrationEventHandler;
import dev.desafio.transaction.payment.application.axon.PaymentProjectionHandler;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcOutboxStore;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.time.Clock;

@Configuration(proxyBeanMethods = false)
@ConditionalOnExpression("'${spring.datasource.url:}' matches '^jdbc:postgresql:.*'")
public class AxonPaymentMessagingConfiguration {
    static final String PAYMENT_QUEUE = "payment.events.v1";

    @Bean
    Clock paymentClock() {
        return Clock.systemUTC();
    }

    @Bean
    PaymentCommandHandler paymentCommandHandler(Clock clock) {
        return new PaymentCommandHandler(clock);
    }

    @Bean
    PaymentEffectLedger paymentEffectLedger(DataSource dataSource) {
        return new JdbcPaymentEffectLedger(dataSource);
    }

    @Bean
    PaymentProjection paymentProjection(DataSource dataSource) {
        return new JdbcPaymentProjection(dataSource);
    }

    @Bean
    PaymentIntegrationEventPublisher paymentIntegrationEventPublisher(
        DataSource dataSource,
        ObjectMapper json
    ) {
        return new JdbcPaymentIntegrationEventPublisher(
            new JdbcOutboxStore(dataSource, json, "payment"),
            json
        );
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
    AxonPaymentRabbitListener axonPaymentRabbitListener(
        DataSource dataSource,
        ObjectMapper json,
        RabbitTemplate rabbit,
        CommandGateway commands,
        Clock clock
    ) {
        var codec = new IntegrationEventJson(json);
        var reliable = new ReliableAmqpConsumer(
            new JdbcInboxStore(dataSource, json, "payment"),
            codec,
            new AmqpRetryRouter(rabbit, clock)
        );
        return new AxonPaymentRabbitListener(reliable, commands);
    }
}
