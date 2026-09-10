package dev.desafio.transaction.payment.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.payment.application.PaymentIntegrationEventPublisher;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.shared.infrastructure.persistence.OutboxStore;

import java.time.Instant;
import java.util.Map;

public final class OutboxPaymentIntegrationEventPublisher implements PaymentIntegrationEventPublisher {
    private final OutboxStore outbox;
    private final ObjectMapper json;

    public OutboxPaymentIntegrationEventPublisher(OutboxStore outbox, ObjectMapper json) {
        this.outbox = java.util.Objects.requireNonNull(outbox, "outbox");
        this.json = java.util.Objects.requireNonNull(json, "json");
    }

    @Override
    public void publish(
        String sourceEventId,
        String eventType,
        String paymentId,
        String transactionId,
        String correlationId,
        String causationId,
        Instant occurredAt,
        Map<String, Object> payload
    ) {
        JsonNode body = json.valueToTree(payload);
        outbox.enqueue(sourceEventId, new IntegrationEventEnvelope<>(
            Payment.stableUuid(correlationId, paymentId, eventType),
            eventType,
            1,
            paymentId,
            transactionId,
            correlationId,
            causationId,
            occurredAt,
            body
        ));
    }
}
