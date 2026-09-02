package dev.desafio.payment.adapter.messaging;

import dev.desafio.payment.application.PaymentHandler;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Declarable;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.ArrayList;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "spring.datasource.url")
public class PaymentRuntimeConfiguration {
    static final String EVENTS = "marketplace.events.v1";
    static final String RETRY = "marketplace.retry.v1";
    static final String DEAD_LETTER = "marketplace.dead-letter.v1";
    static final String DEAD_LETTER_QUEUE = "marketplace.dead-letter.v1";
    static final String PAYMENT_QUEUE = "payment-federation.v1";
    static final String INVENTORY_QUEUE = "payment-federation.inventory.v1";
    static final String QUEUE = PAYMENT_QUEUE;
    static final long[] RETRY_DELAYS = {1_000, 10_000, 60_000};

    @Bean
    PaymentConsumer paymentConsumer(PaymentHandler handler) {
        return new PaymentConsumer(handler);
    }

    @Bean
    Declarables paymentTopology() {
        var events = new TopicExchange(EVENTS, true, false);
        var retry = new DirectExchange(RETRY, true, false);
        var deadLetter = new TopicExchange(DEAD_LETTER, true, false);
        var paymentQueue = QueueBuilder.durable(PAYMENT_QUEUE).quorum().build();
        var inventoryQueue = QueueBuilder.durable(INVENTORY_QUEUE).quorum().build();
        var deadLetterQueue = QueueBuilder.durable(DEAD_LETTER_QUEUE).quorum().build();
        var declarations = new ArrayList<Declarable>();
        declarations.add(events);
        declarations.add(retry);
        declarations.add(deadLetter);
        declarations.add(paymentQueue);
        declarations.add(inventoryQueue);
        declarations.add(deadLetterQueue);
        declarations.add(BindingBuilder.bind(deadLetterQueue).to(deadLetter).with("#"));
        declarations.add(BindingBuilder.bind(paymentQueue).to(events).with("payment.requested"));
        declarations.add(BindingBuilder.bind(paymentQueue).to(events).with("payment.refund-requested"));
        declarations.add(BindingBuilder.bind(inventoryQueue).to(events).with("stock.reservation-requested"));
        addRetryTopology(declarations, retry, events, paymentQueue, PAYMENT_QUEUE);
        addRetryTopology(declarations, retry, events, inventoryQueue, INVENTORY_QUEUE);
        return new Declarables(declarations);
    }

    private static void addRetryTopology(
        ArrayList<Declarable> declarations,
        DirectExchange retry,
        TopicExchange events,
        Queue queue,
        String queueName
    ) {
        for (int index = 0; index < RETRY_DELAYS.length; index++) {
            var attempt = index + 1;
            Queue retryQueue = QueueBuilder.durable(queueName + ".retry." + attempt)
                .quorum()
                .ttl((int) RETRY_DELAYS[index])
                .deadLetterExchange(EVENTS)
                .deadLetterRoutingKey("retry-return." + queueName)
                .build();
            declarations.add(retryQueue);
            declarations.add(BindingBuilder.bind(retryQueue).to(retry).with(queueName + "." + attempt));
        }
        declarations.add(BindingBuilder.bind(queue).to(events).with("retry-return." + queueName));
    }
}
