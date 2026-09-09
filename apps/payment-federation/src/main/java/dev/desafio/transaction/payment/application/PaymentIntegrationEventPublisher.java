package dev.desafio.transaction.payment.application;

import java.time.Instant;
import java.util.Map;

public interface PaymentIntegrationEventPublisher {
    void publish(
        String sourceEventId,
        String eventType,
        String paymentId,
        String transactionId,
        String correlationId,
        String causationId,
        Instant occurredAt,
        Map<String, Object> payload
    );
}
