package dev.desafio.transaction.inventory.application.query;

import dev.desafio.transaction.inventory.domain.InventoryReservation;

import java.time.Instant;
import java.util.Objects;

public record InventoryReservationView(
    String inventoryReservationId,
    String transactionId,
    String orderId,
    InventoryReservation.Status status,
    long version,
    String reason,
    Instant updatedAt
) {
    public InventoryReservationView {
        inventoryReservationId = required(inventoryReservationId, "inventoryReservationId");
        transactionId = required(transactionId, "transactionId");
        orderId = required(orderId, "orderId");
        Objects.requireNonNull(status, "status");
        if (version < 1) throw new IllegalArgumentException("version must be positive");
        Objects.requireNonNull(updatedAt, "updatedAt");
        var rejection = status == InventoryReservation.Status.REJECTED
            || status == InventoryReservation.Status.COMMIT_REJECTED;
        if (rejection != (reason != null && !reason.isBlank())) {
            throw new IllegalArgumentException("reason must identify only a rejected reservation");
        }
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }
}
