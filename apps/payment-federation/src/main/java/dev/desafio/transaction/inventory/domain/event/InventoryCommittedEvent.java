package dev.desafio.transaction.inventory.domain.event;

import java.time.Instant;

public record InventoryCommittedEvent(
    String inventoryReservationId,
    String transactionId,
    String orderId,
    long version,
    String correlationId,
    String causationId,
    Instant occurredAt
) {}
