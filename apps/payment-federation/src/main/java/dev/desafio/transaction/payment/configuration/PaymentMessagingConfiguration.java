package dev.desafio.transaction.payment.configuration;

import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarable;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "spring.datasource.url")
public class PaymentMessagingConfiguration {
    private static final String EVENTS = "marketplace.events.v1";
    private static final String RETRY = "marketplace.retry.v1";
    private static final String DEAD_LETTER = "marketplace.dead-letter.v1";
    private static final String QUEUE = "payment-federation.v1";
    private static final long[] RETRY_DELAYS = {1_000, 10_000, 60_000};

    @Bean
    Declarables paymentTopology() {
        var events = new TopicExchange(EVENTS, true, false);
        var retry = new DirectExchange(RETRY, true, false);
        var deadLetter = new TopicExchange(DEAD_LETTER, true, false);
        var queue = QueueBuilder.durable(QUEUE).quorum().build();
        var deadLetterQueue = QueueBuilder.durable(DEAD_LETTER).quorum().build();
        var declarations = new ArrayList<Declarable>();
        declarations.add(events);
        declarations.add(retry);
        declarations.add(deadLetter);
        declarations.add(queue);
        declarations.add(deadLetterQueue);
        declarations.add(BindingBuilder.bind(deadLetterQueue).to(deadLetter).with("#"));
        declarations.add(BindingBuilder.bind(queue).to(events).with("payment.requested"));
        declarations.add(BindingBuilder.bind(queue).to(events).with("payment.refund-requested"));
        for (int index = 0; index < RETRY_DELAYS.length; index++) {
            var attempt = index + 1;
            Queue retryQueue = QueueBuilder.durable(QUEUE + ".retry." + attempt)
                .quorum()
                .ttl((int) RETRY_DELAYS[index])
                .deadLetterExchange(EVENTS)
                .deadLetterRoutingKey("retry-return." + QUEUE)
                .build();
            declarations.add(retryQueue);
            declarations.add(BindingBuilder.bind(retryQueue).to(retry).with(QUEUE + "." + attempt));
        }
        declarations.add(BindingBuilder.bind(queue).to(events).with("retry-return." + QUEUE));
        return new Declarables(declarations);
    }
}
