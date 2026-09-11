package dev.desafio.transaction.inventory.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;
import dev.desafio.transaction.inventory.application.command.CommitInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReleaseInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommand;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.ObjectProvider;
import dev.desafio.transaction.inventory.application.InventoryService;

import java.util.ArrayList;
import java.util.UUID;
import java.math.BigDecimal;
import java.util.concurrent.CompletionException;

public final class InventoryRabbitListener {
    private final ReliableAmqpConsumer consumer;
    private final CommandGateway commands;

    public InventoryRabbitListener(
        @Qualifier("inventoryReliableAmqpConsumer") ReliableAmqpConsumer consumer,
        CommandGateway commands
    ) {
        this.consumer = consumer;
        this.commands = commands;
    }

    public InventoryRabbitListener(
        ReliableAmqpConsumer consumer,
        CommandGateway commands,
        ObjectProvider<InventoryService> ignoredLegacyInventory,
        RabbitTemplate ignoredRabbit,
        ObjectMapper ignoredJson
    ) {
        this(consumer, commands);
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
            paymentMethod,
            "CARD".equals(paymentMethod) ? required(payload, "providerCredentialReference") : null,
            "CARD".equals(paymentMethod) ? required(payload, "paymentMethodId") : null,
            new BigDecimal(required(payload, "amount")),
            required(payload, "currency"), required(payload, "payerEmail"),
            event.correlationId(), event.eventId().toString()
        );
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
