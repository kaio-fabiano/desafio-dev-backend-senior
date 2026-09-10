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
        Objects.requireNonNull(eventId, "eventId");
        eventType = required(eventType, "eventType");
        if (!eventType.endsWith(".v1")) {
            throw new IllegalArgumentException("eventType must end with .v1");
        }
        if (version != 1) throw new IllegalArgumentException("version must be 1");
        aggregateId = required(aggregateId, "aggregateId");
        transactionId = required(transactionId, "transactionId");
        correlationId = required(correlationId, "correlationId");
        causationId = required(causationId, "causationId");
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(payload, "payload");
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }
}
