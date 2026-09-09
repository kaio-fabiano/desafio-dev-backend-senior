package dev.desafio.transaction.inventory.application.event;

import java.time.Instant;
import java.util.Map;

public record InventoryIntegrationEvent(
    String eventType,
    String aggregateId,
    String transactionId,
    String correlationId,
    String causationId,
    Instant occurredAt,
    Map<String, Object> payload
) {
    public InventoryIntegrationEvent {
        payload = Map.copyOf(payload);
    }
}
