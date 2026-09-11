package dev.desafio.transaction.inventory.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.adapter.messaging.AxonInventoryRabbitListener;
import org.springframework.beans.factory.ObjectProvider;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.ConfirmedAmqpPublisher;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelay;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelayScheduler;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.InboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.InventoryAmqpInboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.InventoryAmqpOutboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaOutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.OutboxStore;
import jakarta.persistence.EntityManager;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "spring.datasource.url")
@EnableScheduling
public class InventoryMessagingConfiguration {

    @Bean("inventoryReliableAmqpConsumer")
    ReliableAmqpConsumer inventoryReliableAmqpConsumer(
        @Qualifier("inventoryInboxStore") InboxStore inbox,
        ObjectMapper objectMapper,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        return new ReliableAmqpConsumer(
            inbox,
            new IntegrationEventJson(objectMapper),
            new AmqpRetryRouter(rabbit, clock)
        );
    }

    @Bean
    AxonInventoryRabbitListener inventoryRabbitListener(
        @Qualifier("inventoryReliableAmqpConsumer") ReliableAmqpConsumer consumer,
        CommandGateway commands,
        ObjectProvider<InventoryService> ignoredLegacyInventory,
        RabbitTemplate ignoredRabbit,
        ObjectMapper ignoredJson
    ) {
        return new AxonInventoryRabbitListener(consumer, commands);
    }

    @Bean("inventoryInboxStore")
    InboxStore inventoryInboxStore(
        InventoryAmqpInboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        Clock clock,
        PlatformTransactionManager transactionManager
    ) {
        return JpaInboxStore.inventory(records, entityManager, json, clock, transactionManager);
    }

    @Bean("inventoryOutboxStore")
    OutboxStore inventoryOutboxStore(
        InventoryAmqpOutboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        PlatformTransactionManager transactionManager
    ) {
        return JpaOutboxStore.inventory(records, entityManager, json, transactionManager);
    }


    @Bean("inventoryOutboxRelay")
    OutboxRelay inventoryOutboxRelay(
        @Qualifier("inventoryOutboxStore") OutboxStore outbox,
        ObjectMapper objectMapper,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        var json = new IntegrationEventJson(objectMapper);
        return new OutboxRelay(
            outbox,
            new ConfirmedAmqpPublisher(rabbit, json), json, clock, "inventory-relay"
        );
    }

    @Bean
    @ConditionalOnProperty(
        name = "spring.flyway.enabled",
        havingValue = "true",
        matchIfMissing = true
    )
    OutboxRelayScheduler inventoryOutboxRelayScheduler(
        @Qualifier("inventoryOutboxRelay") OutboxRelay relay
    ) {
        return new OutboxRelayScheduler(relay);
    }
}
