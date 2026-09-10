package dev.desafio.transaction.inventory.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;
import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.application.command.CommitInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReleaseInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommand;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.ObjectProvider;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.UUID;
import java.math.BigDecimal;
import java.util.concurrent.CompletionException;

public final class InventoryRabbitListener {
    private static final String INVENTORY_QUEUE = "payment-federation.inventory.v1";
    private final ReliableAmqpConsumer consumer;
    private final CommandGateway commands;
    private final ObjectProvider<InventoryService> legacyInventory;
    private final RabbitTemplate rabbit;
    private final ObjectMapper json;

    public InventoryRabbitListener(
        @Qualifier("inventoryReliableAmqpConsumer") ReliableAmqpConsumer consumer,
        CommandGateway commands,
        ObjectProvider<InventoryService> legacyInventory,
        RabbitTemplate rabbit,
        ObjectMapper json
    ) {
        this.consumer = consumer;
        this.commands = commands;
        this.legacyInventory = legacyInventory;
        this.rabbit = rabbit;
        this.json = json;
    }

    @RabbitListener(queues = "inventory.events.v1")
    public void receive(Message message, Channel channel) throws Exception {
        validateTraceparent(message);
        consumer.receive("inventory", message, channel, this::dispatch);
    }

    private void dispatch(IntegrationEventEnvelope<JsonNode> event) {
        try {
            commands.send(command(event), Object.class).join();
        } catch (CompletionException error) {
            var cause = error.getCause();
            while (cause != null && cause.getCause() != null) cause = cause.getCause();
            if (cause instanceof RuntimeException runtime) throw runtime;
            throw error;
        }
    }

    @RabbitListener(
        queues = INVENTORY_QUEUE,
        autoStartup = "${inventory.legacy-listener-enabled:false}"
    )
    public void receiveLegacy(Message message, Channel channel) throws Exception {
        var deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            var envelope = json.readTree(message.getBody());
            var payload = envelope.path("payload");
            var items = new ArrayList<Inventory.StockItem>();
            payload.path("items").forEach(item -> items.add(new Inventory.StockItem(
                required(item, "productId"), item.path("quantity").asInt()
            )));
            var result = legacyInventory.getObject().handle(new Inventory.ReservationRequested(
                UUID.fromString(required(envelope, "eventId")),
                required(envelope, "operationKey"), required(payload, "orderId"), items
            ));
            publishLegacy(result.event(), envelope.path("traceContext"));
            channel.basicAck(deliveryTag, false);
        } catch (Exception error) {
            channel.basicNack(deliveryTag, false, true);
            throw error;
        }
    }

    private Object command(IntegrationEventEnvelope<JsonNode> event) {
        return switch (event.eventType()) {
            case "transaction.order-received.v1" -> reserve(event);
            case "payment.approved.v1" -> new CommitInventoryCommand(
                "inventory:" + event.transactionId(), event.correlationId(), event.eventId().toString()
            );
            case "payment.rejected.v1", "transaction.cancelled.v1" -> new ReleaseInventoryCommand(
                "inventory:" + event.transactionId(), event.correlationId(), event.eventId().toString()
            );
            default -> throw new ReliableAmqpConsumer.BusinessRejection(
                InventoryErrorMessages.unsupportedIntegrationEvent(event.eventType())
            );
        };
    }

    private ReserveInventoryCommand reserve(IntegrationEventEnvelope<JsonNode> event) {
        var payload = event.payload();
        var paymentMethod = required(payload, "paymentMethod");
        var items = new ArrayList<StockItem>();
        payload.path("items").forEach(item -> items.add(new StockItem(
            required(item, "productId"), item.path("quantity").asInt()
        )));
        return new ReserveInventoryCommand(
            "inventory:" + event.transactionId(), event.eventId(),
            event.correlationId() + ":inventory-reserve",
            event.transactionId(), required(payload, "orderId"), items,
            required(payload, "paymentId"), required(payload, "paymentOperationKey"),
            paymentMethod, new BigDecimal(required(payload, "amount")),
            required(payload, "currency"), required(payload, "payerEmail"),
            "CARD".equals(paymentMethod) ? required(payload, "providerCredentialReference") : null,
            "CARD".equals(paymentMethod) ? required(payload, "paymentMethodId") : null,
            event.correlationId(), event.eventId().toString()
        );
    }

    private void publishLegacy(Inventory.OutgoingEvent event, JsonNode traceContext) throws Exception {
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
            operations.convertAndSend("marketplace.events.v1", event.eventType(), body, sent -> {
                sent.getMessageProperties().setMessageId(event.eventId().toString());
                sent.getMessageProperties().setCorrelationId(event.operationKey());
                sent.getMessageProperties().setContentType("application/json");
                sent.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                return sent;
            });
            operations.waitForConfirmsOrDie(10_000);
            return null;
        });
    }

    private static void validateTraceparent(Message message) {
        var traceparent = message.getMessageProperties().getHeader("traceparent");
        if (traceparent != null && !traceparent.toString().matches(
            "00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}"
        )) {
            throw new IllegalArgumentException(InventoryErrorMessages.TRACEPARENT_INVALID);
        }
    }

    private static String required(JsonNode node, String field) {
        var value = node.path(field).asText();
        if (value.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.required(field));
        }
        return value;
    }
}
