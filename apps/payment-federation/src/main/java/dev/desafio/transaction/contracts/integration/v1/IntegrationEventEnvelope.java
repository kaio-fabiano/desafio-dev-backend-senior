package dev.desafio.transaction.contracts.integration.v1;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record IntegrationEventEnvelope<T>(
    UUID eventId,
    String eventType,
    int version,
    String aggregateId,
    String transactionId,
    String correlationId,
    String causationId,
    Instant occurredAt,
    T payload
) {
    public IntegrationEventEnvelope {
        Objects.requireNonNull(eventId, IntegrationEventErrorMessages.EVENT_ID_REQUIRED);
        eventType = required(eventType, "eventType");
        if (!eventType.endsWith(".v1")) {
            throw new IllegalArgumentException(IntegrationEventErrorMessages.EVENT_TYPE_VERSION);
        }
        if (version != 1) throw new IllegalArgumentException(IntegrationEventErrorMessages.VERSION);
        aggregateId = required(aggregateId, "aggregateId");
        transactionId = required(transactionId, "transactionId");
        correlationId = required(correlationId, "correlationId");
        causationId = required(causationId, "causationId");
        Objects.requireNonNull(occurredAt, IntegrationEventErrorMessages.OCCURRED_AT_REQUIRED);
        Objects.requireNonNull(payload, IntegrationEventErrorMessages.PAYLOAD_REQUIRED);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(IntegrationEventErrorMessages.required(field));
        }
        return value;
    }
}
