package dev.desafio.transaction.payment.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.application.command.RefundPayment;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;

import java.math.BigDecimal;

public final class AxonPaymentRabbitListener {
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
        var command = switch (event.eventType()) {
            case "inventory.reserved.v1" -> request(event);
            case "inventory.commit-rejected.v1", "transaction.cancelled.v1" -> refund(event);
            default -> throw new ReliableAmqpConsumer.BusinessRejection(
                PaymentErrorMessages.paymentDoesNotConsume(event.eventType())
            );
        };
        commands.send(command, String.class).join();
    }

    private RequestPayment request(IntegrationEventEnvelope<JsonNode> event) {
        var payload = event.payload();
        var method = Payment.Method.valueOf(required(payload, "method"));
        return new RequestPayment(
            required(payload, "paymentId"), required(payload, "paymentOperationKey"),
            event.transactionId(),
            method,
            new BigDecimal(required(payload, "amount")),
            required(payload, "currency"),
            method == Payment.Method.CARD ? required(payload, "providerCredentialReference") : null,
            required(payload, "payerEmail"),
            method == Payment.Method.CARD ? required(payload, "paymentMethodId") : null,
            event.correlationId(),
            event.eventId().toString()
        );
    }

    private RefundPayment refund(IntegrationEventEnvelope<JsonNode> event) {
        return new RefundPayment(
            "payment:" + event.transactionId(), event.correlationId() + ":payment", event.transactionId(),
            event.payload().path("reason").asText("INVENTORY_COMMIT_REJECTED"),
            event.correlationId(), event.eventId().toString()
        );
    }

    private String required(JsonNode payload, String field) {
        var value = payload.path(field).asText();
        if (value.isBlank()) throw new IllegalArgumentException(PaymentErrorMessages.required(field));
        return value;
    }
}
