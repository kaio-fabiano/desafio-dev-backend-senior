package dev.desafio.transaction.payment.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;

import java.math.BigDecimal;

public final class AxonPaymentRabbitListener {
    static final String EVENT_TYPE = "inventory.reserved.v1";

    private final ReliableAmqpConsumer consumer;
    private final CommandGateway commands;

    public AxonPaymentRabbitListener(ReliableAmqpConsumer consumer, CommandGateway commands) {
        this.consumer = java.util.Objects.requireNonNull(consumer, "consumer");
        this.commands = java.util.Objects.requireNonNull(commands, "commands");
    }

    @RabbitListener(queues = "payment.events.v1")
    public void receive(Message message, Channel channel) throws Exception {
        consumer.receive("payment", message, channel, this::dispatch);
    }

    private void dispatch(IntegrationEventEnvelope<JsonNode> event) {
        if (!EVENT_TYPE.equals(event.eventType())) {
            throw new ReliableAmqpConsumer.BusinessRejection(
                "Payment only consumes InventoryReserved"
            );
        }
        var payload = event.payload();
        var method = Payment.Method.valueOf(required(payload, "method"));
        commands.send(new RequestPayment(
            required(payload, "paymentId"),
            required(payload, "operationKey"),
            event.transactionId(),
            method,
            new BigDecimal(required(payload, "amount")),
            required(payload, "currency"),
            method == Payment.Method.CARD ? required(payload, "providerCredentialReference") : null,
            required(payload, "payerEmail"),
            method == Payment.Method.CARD ? required(payload, "paymentMethodId") : null,
            event.correlationId(),
            event.eventId().toString()
        ), String.class).join();
    }

    private String required(JsonNode payload, String field) {
        var value = payload.path(field).asText();
        if (value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }
}
