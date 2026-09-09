package dev.desafio.transaction.shared.infrastructure.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.rabbitmq.client.AMQP;
import dev.desafio.transaction.configuration.MarketplaceAmqp;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Date;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

public final class ConfirmedAmqpPublisher {
    private final RabbitTemplate rabbit;
    private final IntegrationEventJson json;

    public ConfirmedAmqpPublisher(RabbitTemplate rabbit, IntegrationEventJson json) {
        this.rabbit = rabbit;
        this.json = json;
    }

    public void publish(IntegrationEventEnvelope<JsonNode> event) {
        publish(event, event.eventType());
    }

    public void publish(IntegrationEventEnvelope<JsonNode> event, String routingKey) {
        var body = json.write(event);
        rabbit.execute(channel -> {
            var returned = new AtomicReference<String>();
            channel.addReturnListener((replyCode, replyText, exchange, key, properties, returnedBody) ->
                returned.set(replyCode + " " + replyText)
            );
            channel.confirmSelect();
            channel.basicPublish(
                MarketplaceAmqp.EVENTS_EXCHANGE,
                routingKey,
                true,
                properties(event),
                body
            );
            channel.waitForConfirmsOrDie(10_000);
            if (returned.get() != null) throw new AmqpException("unroutable event: " + returned.get());
            return null;
        });
    }

    private AMQP.BasicProperties properties(IntegrationEventEnvelope<JsonNode> event) {
        return new AMQP.BasicProperties.Builder()
            .contentType("application/json")
            .contentEncoding("UTF-8")
            .deliveryMode(2)
            .messageId(event.eventId().toString())
            .type(event.eventType())
            .correlationId(event.correlationId())
            .timestamp(Date.from(event.occurredAt()))
            .headers(Map.of(
                "version", event.version(),
                "aggregateId", event.aggregateId(),
                "transactionId", event.transactionId(),
                "causationId", event.causationId()
            ))
            .build();
    }
}
