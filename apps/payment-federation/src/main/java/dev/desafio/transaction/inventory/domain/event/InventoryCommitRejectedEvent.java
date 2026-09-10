package dev.desafio.transaction.inventory.domain.event;

import java.time.Instant;

public record InventoryCommitRejectedEvent(
    String inventoryReservationId,
    String transactionId,
    String orderId,
    String reason,
    long version,
    String correlationId,
    String causationId,
    Instant occurredAt
) {}
