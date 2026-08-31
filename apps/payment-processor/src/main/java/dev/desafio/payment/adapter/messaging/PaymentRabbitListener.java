package dev.desafio.payment.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.desafio.payment.application.PaymentRepository;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "spring.datasource.url")
public final class PaymentRabbitListener {
    private static final Logger LOG = LoggerFactory.getLogger(PaymentRabbitListener.class);
    private final PaymentConsumer consumer;
    private final RabbitTemplate rabbit;
    private final ObjectMapper json;

    public PaymentRabbitListener(
        PaymentConsumer consumer,
        RabbitTemplate rabbit,
        ObjectMapper json
    ) {
        this.consumer = consumer;
        this.rabbit = rabbit;
        this.json = json;
        rabbit.setMandatory(true);
    }

    @RabbitListener(queues = PaymentRuntimeConfiguration.QUEUE)
    public void receive(Message message, Channel channel) throws Exception {
        var deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            var result = consumer.consume(delivery(message), () -> {});
            publish(result);
        } catch (Exception error) {
            LOG.warn("Payment event processing failed; routing to retry", error);
            try {
                routeFailure(message);
            } catch (Exception routingError) {
                routingError.addSuppressed(error);
                channel.basicNack(deliveryTag, false, true);
                return;
            }
        }
        channel.basicAck(deliveryTag, false);
    }

    private PaymentConsumer.Delivery delivery(Message message) throws Exception {
        JsonNode envelope = json.readTree(message.getBody());
        JsonNode payload = envelope.path("payload");
        var type = required(envelope, "eventType");
        var eventId = UUID.fromString(required(envelope, "eventId"));
        var operationKey = required(envelope, "operationKey");
        var paymentId = required(payload, "paymentId");
        var orderId = required(payload, "orderId");
        if ("payment.requested".equals(type)) {
            return new PaymentConsumer.Delivery(eventId, type, operationKey, paymentId, orderId,
                required(payload, "method"), new BigDecimal(required(payload, "amount")),
                required(payload, "currency"), null);
        }
        return new PaymentConsumer.Delivery(eventId, type, operationKey, paymentId, orderId,
            null, null, null, required(payload, "reason"));
    }

    private void publish(PaymentRepository.ProcessingResult result) throws Exception {
        var event = result.outgoingEvent();
        var envelope = new HashMap<String, Object>();
        envelope.put("eventId", event.eventId());
        envelope.put("eventType", event.eventType());
        envelope.put("eventVersion", event.eventVersion());
        envelope.put("operationKey", event.operationKey());
        envelope.put("correlationId", event.operationKey());
        envelope.put("occurredAt", event.occurredAt());
        envelope.put("payload", event.payload());
        var body = json.writeValueAsBytes(envelope);
        rabbit.invoke(operations -> {
            operations.convertAndSend(PaymentRuntimeConfiguration.EVENTS, event.eventType(), body, sent -> {
                sent.getMessageProperties().setMessageId(event.eventId().toString());
                sent.getMessageProperties().setCorrelationId(event.operationKey());
                sent.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                sent.getMessageProperties().setType(event.eventType());
                sent.getMessageProperties().setTimestamp(java.util.Date.from(event.occurredAt()));
                return sent;
            });
            operations.waitForConfirmsOrDie(10_000);
            return null;
        });
    }

    private void routeFailure(Message message) throws Exception {
        var properties = message.getMessageProperties();
        var attemptValue = properties.getHeaders().getOrDefault("x-retry-attempt", 0);
        int attempt = attemptValue instanceof Number number ? number.intValue() : Integer.parseInt(attemptValue.toString());
        var nextAttempt = attempt + 1;
        properties.setHeader("x-retry-attempt", nextAttempt);
        if (nextAttempt <= PaymentRuntimeConfiguration.RETRY_DELAYS.length) {
            rabbit.invoke(operations -> {
                operations.send(PaymentRuntimeConfiguration.RETRY, PaymentRuntimeConfiguration.QUEUE + "." + nextAttempt, message);
                operations.waitForConfirmsOrDie(10_000);
                return null;
            });
            return;
        }
        var failure = new HashMap<String, Object>();
        failure.put("eventId", properties.getMessageId());
        failure.put("eventType", properties.getType());
        failure.put("correlationId", properties.getCorrelationId());
        failure.put("failedAt", Instant.now());
        failure.put("reason", "CONSUMER_FAILED");
        var body = json.writeValueAsBytes(failure);
        rabbit.invoke(operations -> {
            operations.convertAndSend(PaymentRuntimeConfiguration.DEAD_LETTER,
                properties.getType() == null ? "payment.failed" : properties.getType(), body, sent -> {
                    sent.getMessageProperties().setMessageId(properties.getMessageId());
                    sent.getMessageProperties().setCorrelationId(properties.getCorrelationId());
                    sent.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                    sent.getMessageProperties().setType(properties.getType());
                    return sent;
                });
            operations.waitForConfirmsOrDie(10_000);
            return null;
        });
    }

    private static String required(JsonNode node, String field) {
        var value = node.path(field).asText();
        if (value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }
}
