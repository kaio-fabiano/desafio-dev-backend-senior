package dev.desafio.transaction.shared.infrastructure.messaging;

import dev.desafio.transaction.configuration.MarketplaceAmqp;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Clock;

public final class AmqpRetryRouter {
    private final RabbitTemplate rabbit;
    private final Clock clock;

    public AmqpRetryRouter(RabbitTemplate rabbit, Clock clock) {
        this.rabbit = rabbit;
        this.clock = clock;
        rabbit.setMandatory(true);
    }

    public void routeTechnicalFailure(String consumer, Message original, Exception failure) {
        var currentAttempt = retryAttempt(original);
        var nextAttempt = currentAttempt + 1;
        var message = MessageBuilder.fromClonedMessage(original)
            .setDeliveryMode(MessageDeliveryMode.PERSISTENT)
            .setHeader("x-retry-attempt", nextAttempt)
            .setHeader("x-consumer", consumer)
            .setHeader("x-failure-class", failure.getClass().getName())
            .setHeader("x-failed-at", clock.instant().toString())
            .build();
        if (nextAttempt <= MarketplaceAmqp.RETRY_DELAYS.length) {
            confirmedSend(
                MarketplaceAmqp.RETRY_EXCHANGE,
                MarketplaceAmqp.retryRoutingKey(consumer, nextAttempt),
                message
            );
        } else {
            confirmedSend(MarketplaceAmqp.DEAD_LETTER_EXCHANGE, consumer, message);
        }
    }

    private void confirmedSend(String exchange, String routingKey, Message message) {
        rabbit.invoke(operations -> {
            operations.send(exchange, routingKey, message);
            operations.waitForConfirmsOrDie(10_000);
            return null;
        });
    }

    private int retryAttempt(Message message) {
        var value = message.getMessageProperties().getHeader("x-retry-attempt");
        if (value == null) return 0;
        return value instanceof Number number ? number.intValue() : Integer.parseInt(value.toString());
    }
}
