package dev.desafio.transaction.inventory.application.event;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

public record InventoryIntegrationMessage(
    String eventType,
    String aggregateId,
    String transactionId,
    String correlationId,
    String causationId,
    Instant occurredAt,
    Map<String, Object> payload
) {
    public InventoryIntegrationMessage {
        eventType = required(eventType, "eventType");
        aggregateId = required(aggregateId, "aggregateId");
        transactionId = required(transactionId, "transactionId");
        correlationId = required(correlationId, "correlationId");
        causationId = required(causationId, "causationId");
        Objects.requireNonNull(occurredAt, "occurredAt");
        payload = Map.copyOf(payload);
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }
}
