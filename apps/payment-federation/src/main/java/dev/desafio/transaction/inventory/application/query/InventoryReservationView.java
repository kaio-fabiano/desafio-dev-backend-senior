package dev.desafio.transaction.inventory.application.query;

import dev.desafio.transaction.inventory.domain.InventoryReservation;

import java.time.Instant;

public record InventoryReservationView(
    String inventoryReservationId,
    String transactionId,
    String orderId,
    InventoryReservation.Status status,
    long version,
    String reason,
    Instant updatedAt
) {}
