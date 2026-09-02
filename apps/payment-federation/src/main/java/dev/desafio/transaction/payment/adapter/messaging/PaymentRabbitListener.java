package dev.desafio.transaction.payment.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.payment.application.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "spring.datasource.url")
public final class PaymentRabbitListener {
    private static final Logger LOG = LoggerFactory.getLogger(PaymentRabbitListener.class);
    private static final String EVENTS = "marketplace.events.v1";
    private static final String RETRY = "marketplace.retry.v1";
    private static final String DEAD_LETTER = "marketplace.dead-letter.v1";
    private static final String QUEUE = "payment-federation.v1";
    private static final long[] RETRY_DELAYS = {1_000, 10_000, 60_000};

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

    @RabbitListener(queues = QUEUE)
    public void receive(Message message, Channel channel) throws Exception {
        var deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            var result = consumer.consume(delivery(message), () -> {});
            if (result.outgoingEvent() != null) publish(result, message);
            LOG.info(
                "Payment event completed eventId={} operationKey={}",
                message.getMessageProperties().getMessageId(),
                message.getMessageProperties().getCorrelationId()
            );
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
            return new PaymentConsumer.Delivery(
                eventId,
                type,
                operationKey,
                paymentId,
                orderId,
                required(payload, "method"),
                new BigDecimal(required(payload, "amount")),
                required(payload, "currency"),
                optional(payload, "providerToken"),
                required(payload, "payerEmail"),
                optional(payload, "paymentMethodId"),
                null
            );
        }
        return new PaymentConsumer.Delivery(
            eventId,
            type,
            operationKey,
            paymentId,
            orderId,
            null,
            null,
            null,
            null,
            null,
            null,
            required(payload, "reason")
        );
    }

    private void publish(
        PaymentRepository.ProcessingResult result,
        Message source
    ) throws Exception {
        var event = result.outgoingEvent();
        var envelope = new HashMap<String, Object>();
        envelope.put("eventId", event.eventId());
        envelope.put("eventType", event.eventType());
        envelope.put("eventVersion", event.eventVersion());
        envelope.put("operationKey", event.operationKey());
        envelope.put("occurredAt", event.occurredAt());
        envelope.put("payload", event.payload());
        envelope.put(
            "traceContext",
            requiredObject(json.readTree(source.getBody()), "traceContext")
        );
        var body = json.writeValueAsBytes(envelope);
        rabbit.invoke(operations -> {
            operations.convertAndSend(EVENTS, event.eventType(), body, sent -> {
                sent.getMessageProperties().setMessageId(event.eventId().toString());
                sent.getMessageProperties().setCorrelationId(event.operationKey());
                sent.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                sent.getMessageProperties().setType(event.eventType());
                sent.getMessageProperties().setTimestamp(java.util.Date.from(event.occurredAt()));
                var traceparent = source.getMessageProperties().getHeader("traceparent");
                if (traceparent != null) {
                    sent.getMessageProperties().setHeader("traceparent", traceparent);
                }
                return sent;
            });
            operations.waitForConfirmsOrDie(10_000);
            return null;
        });
    }

    private void routeFailure(Message message) throws Exception {
        var properties = message.getMessageProperties();
        var attemptValue = properties.getHeaders().getOrDefault("x-retry-attempt", 0);
        int attempt = attemptValue instanceof Number number
            ? number.intValue()
            : Integer.parseInt(attemptValue.toString());
        var nextAttempt = attempt + 1;
        properties.setHeader("x-retry-attempt", nextAttempt);
        if (nextAttempt <= RETRY_DELAYS.length) {
            rabbit.invoke(operations -> {
                operations.send(RETRY, QUEUE + "." + nextAttempt, message);
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
            operations.convertAndSend(
                DEAD_LETTER,
                properties.getType() == null ? "payment.failed" : properties.getType(),
                body,
                sent -> {
                    sent.getMessageProperties().setMessageId(properties.getMessageId());
                    sent.getMessageProperties().setCorrelationId(properties.getCorrelationId());
                    sent.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                    sent.getMessageProperties().setType(properties.getType());
                    return sent;
                }
            );
            operations.waitForConfirmsOrDie(10_000);
            return null;
        });
    }

    private static String required(JsonNode node, String field) {
        var value = node.path(field).asText();
        if (value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }

    private static String optional(JsonNode node, String field) {
        var value = node.path(field).asText();
        return value.isBlank() ? null : value;
    }

    private static JsonNode requiredObject(JsonNode node, String field) {
        var value = node.path(field);
        if (!value.isObject()) throw new IllegalArgumentException(field + " is required");
        return value;
    }
}
