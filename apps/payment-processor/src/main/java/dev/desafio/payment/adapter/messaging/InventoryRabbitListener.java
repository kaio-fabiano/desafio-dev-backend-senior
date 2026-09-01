package dev.desafio.payment.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.desafio.payment.inventory.InventoryService;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = {"spring.datasource.url", "wordpress.graphql-url"})
public final class InventoryRabbitListener {
    private static final Logger LOG = LoggerFactory.getLogger(InventoryRabbitListener.class);
    private final InventoryService inventory;
    private final RabbitTemplate rabbit;
    private final ObjectMapper json;

    public InventoryRabbitListener(InventoryService inventory, RabbitTemplate rabbit, ObjectMapper json) {
        this.inventory = inventory;
        this.rabbit = rabbit;
        this.json = json;
        rabbit.setMandatory(true);
    }

    @RabbitListener(queues = PaymentRuntimeConfiguration.INVENTORY_QUEUE)
    public void receive(Message message, Channel channel) throws Exception {
        var deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            var delivery = delivery(message);
            var result = inventory.handle(delivery.request());
            publish(result.event(), delivery.traceContext());
            LOG.info("Inventory event completed eventId={} operationKey={}",
                message.getMessageProperties().getMessageId(),
                message.getMessageProperties().getCorrelationId());
        } catch (InventoryService.InventoryConflictException error) {
            LOG.error("Inventory event rejected eventId={} operationKey={}",
                message.getMessageProperties().getMessageId(),
                message.getMessageProperties().getCorrelationId(), error);
            routePermanentFailure(message);
        } catch (Exception error) {
            LOG.warn("Inventory event failed eventId={} operationKey={}",
                message.getMessageProperties().getMessageId(),
                message.getMessageProperties().getCorrelationId(), error);
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

    private Delivery delivery(Message message) throws Exception {
        JsonNode envelope = json.readTree(message.getBody());
        if (!"stock.reservation-requested".equals(required(envelope, "eventType"))) {
            throw new IllegalArgumentException("unsupported inventory event");
        }
        var payload = envelope.path("payload");
        var items = new ArrayList<InventoryService.StockItem>();
        for (var item : payload.path("items")) {
            items.add(new InventoryService.StockItem(
                required(item, "productId"),
                item.path("quantity").asInt()
            ));
        }
        var trace = envelope.path("traceContext");
        var traceContext = new HashMap<String, String>();
        traceContext.put("traceId", required(trace, "traceId"));
        if (!trace.path("spanId").asText().isBlank()) {
            traceContext.put("spanId", trace.path("spanId").asText());
        }
        return new Delivery(
            new InventoryService.ReservationRequested(
                UUID.fromString(required(envelope, "eventId")),
                required(envelope, "operationKey"),
                required(payload, "orderId"),
                items
            ),
            Map.copyOf(traceContext)
        );
    }

    private void publish(InventoryService.OutgoingEvent event, Map<String, String> traceContext) throws Exception {
        var envelope = new HashMap<String, Object>();
        envelope.put("eventId", event.eventId());
        envelope.put("eventType", event.eventType());
        envelope.put("eventVersion", event.eventVersion());
        envelope.put("operationKey", event.operationKey());
        envelope.put("occurredAt", event.occurredAt());
        envelope.put("traceContext", traceContext);
        envelope.put("payload", event.payload());
        var body = json.writeValueAsBytes(envelope);
        rabbit.invoke(operations -> {
            operations.convertAndSend(PaymentRuntimeConfiguration.EVENTS, event.eventType(), body, sent -> {
                sent.getMessageProperties().setMessageId(event.eventId().toString());
                sent.getMessageProperties().setCorrelationId(event.operationKey());
                sent.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                sent.getMessageProperties().setType(event.eventType());
                sent.getMessageProperties().setTimestamp(java.util.Date.from(event.occurredAt()));
                var traceId = traceContext.get("traceId");
                var spanId = traceContext.getOrDefault("spanId", traceId.substring(0, 16));
                sent.getMessageProperties().setHeader("traceparent", "00-" + traceId + "-" + spanId + "-01");
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
                operations.send(
                    PaymentRuntimeConfiguration.RETRY,
                    PaymentRuntimeConfiguration.INVENTORY_QUEUE + "." + nextAttempt,
                    message
                );
                operations.waitForConfirmsOrDie(10_000);
                return null;
            });
            return;
        }
        routePermanentFailure(message);
    }

    private void routePermanentFailure(Message message) throws Exception {
        var properties = message.getMessageProperties();
        var failure = new HashMap<String, Object>();
        failure.put("eventId", properties.getMessageId());
        failure.put("eventType", properties.getType());
        failure.put("correlationId", properties.getCorrelationId());
        failure.put("failedAt", Instant.now());
        failure.put("reason", "CONSUMER_FAILED");
        var body = json.writeValueAsBytes(failure);
        rabbit.invoke(operations -> {
            operations.convertAndSend(
                PaymentRuntimeConfiguration.DEAD_LETTER,
                properties.getType() == null ? "stock.reservation-requested" : properties.getType(),
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

    private record Delivery(
        InventoryService.ReservationRequested request,
        Map<String, String> traceContext
    ) {}
}
