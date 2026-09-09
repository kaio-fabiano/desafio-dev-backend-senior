package dev.desafio.transaction.inventory.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.ConfirmedAmqpPublisher;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelay;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcOutboxStore;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import javax.sql.DataSource;
import java.time.Clock;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "spring.datasource.url")
@EnableScheduling
public class InventoryMessagingConfiguration {
    private static final String INVENTORY_QUEUE = "payment-federation.inventory.v1";
    private static final String LEGACY_EVENT = "stock.reservation-requested";

    @Bean
    @ConditionalOnProperty(name = "inventory.legacy-listener-enabled", havingValue = "true")
    Declarables legacyInventoryTopology() {
        var events = new TopicExchange("marketplace.events.v1", true, false);
        var queue = QueueBuilder.durable(INVENTORY_QUEUE).quorum().build();
        return new Declarables(events, queue, BindingBuilder.bind(queue).to(events).with(LEGACY_EVENT));
    }

    @Bean("inventoryReliableAmqpConsumer")
    ReliableAmqpConsumer inventoryReliableAmqpConsumer(
        DataSource dataSource,
        ObjectMapper objectMapper,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        return new ReliableAmqpConsumer(
            new JdbcInboxStore(dataSource, objectMapper, "inventory"),
            new IntegrationEventJson(objectMapper),
            new AmqpRetryRouter(rabbit, clock)
        );
    }

    @Bean("inventoryOutboxRelay")
    OutboxRelay inventoryOutboxRelay(
        DataSource dataSource,
        ObjectMapper objectMapper,
        RabbitTemplate rabbit,
        Clock clock
    ) {
        var json = new IntegrationEventJson(objectMapper);
        return new OutboxRelay(
            new JdbcOutboxStore(dataSource, objectMapper, "inventory"),
            new ConfirmedAmqpPublisher(rabbit, json), json, clock, "inventory-relay"
        );
    }
}
