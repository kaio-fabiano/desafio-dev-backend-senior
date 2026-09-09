package dev.desafio.transaction.configuration;

import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarable;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Configuration(proxyBeanMethods = false)
public class AmqpTopologyConfiguration {
    private static final Map<String, List<String>> BINDINGS = Map.of(
        "transaction", List.of(
            "inventory.reserved.v1",
            "inventory.reservation-rejected.v1",
            "inventory.committed.v1",
            "inventory.commit-rejected.v1",
            "inventory.released.v1",
            "payment.pending.v1",
            "payment.approved.v1",
            "payment.rejected.v1",
            "payment.refunded.v1"
        ),
        "inventory", List.of(
            "transaction.order-received.v1",
            "transaction.cancelled.v1",
            "payment.approved.v1",
            "payment.rejected.v1"
        ),
        "payment", List.of(
            "inventory.reserved.v1",
            "inventory.commit-rejected.v1",
            "transaction.cancelled.v1"
        )
    );

    @Bean
    public Declarables marketplaceAmqpTopology() {
        var events = new TopicExchange(MarketplaceAmqp.EVENTS_EXCHANGE, true, false);
        var retry = new DirectExchange(MarketplaceAmqp.RETRY_EXCHANGE, true, false);
        var deadLetter = new DirectExchange(MarketplaceAmqp.DEAD_LETTER_EXCHANGE, true, false);
        var declarations = new ArrayList<Declarable>();
        declarations.addAll(List.of(events, retry, deadLetter));

        BINDINGS.forEach((consumer, routingKeys) -> {
            var eventQueue = quorum(MarketplaceAmqp.eventQueue(consumer));
            var deadLetterQueue = quorum(MarketplaceAmqp.deadLetterQueue(consumer));
            declarations.add(eventQueue);
            declarations.add(deadLetterQueue);
            routingKeys.forEach(routingKey -> declarations.add(
                BindingBuilder.bind(eventQueue).to(events).with(routingKey)
            ));
            declarations.add(BindingBuilder.bind(eventQueue).to(events).with(
                MarketplaceAmqp.retryReturnRoutingKey(consumer)
            ));
            declarations.add(BindingBuilder.bind(deadLetterQueue).to(deadLetter).with(consumer));

            for (int index = 0; index < MarketplaceAmqp.RETRY_DELAYS.length; index++) {
                var attempt = index + 1;
                Queue retryQueue = QueueBuilder
                    .durable(MarketplaceAmqp.retryQueue(consumer, attempt))
                    .quorum()
                    .ttl((int) MarketplaceAmqp.RETRY_DELAYS[index])
                    .deadLetterExchange(MarketplaceAmqp.EVENTS_EXCHANGE)
                    .deadLetterRoutingKey(MarketplaceAmqp.retryReturnRoutingKey(consumer))
                    .build();
                declarations.add(retryQueue);
                declarations.add(BindingBuilder.bind(retryQueue).to(retry).with(
                    MarketplaceAmqp.retryRoutingKey(consumer, attempt)
                ));
            }
        });
        return new Declarables(declarations);
    }

    private static Queue quorum(String name) {
        return QueueBuilder.durable(name).quorum().build();
    }
}
