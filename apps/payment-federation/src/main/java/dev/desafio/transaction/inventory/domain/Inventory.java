package dev.desafio.transaction.inventory.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public final class Inventory {
    private Inventory() {}

    public enum StockState { AVAILABLE, RESERVED, INSUFFICIENT }

    public static final class InsufficientStockException extends RuntimeException {
        public InsufficientStockException() {
            super(InventoryErrorMessages.INSUFFICIENT_STOCK);
        }
    }

    public static final class InventoryConflictException extends RuntimeException {
        public InventoryConflictException(String orderId) {
            super(InventoryErrorMessages.inventoryConflict(orderId));
        }
    }

    public record StockItem(String productId, int quantity) {
        public StockItem {
            productId = required(productId, "productId");
            if (quantity < 1) throw new IllegalArgumentException(InventoryErrorMessages.QUANTITY_MUST_BE_POSITIVE);
        }
    }

    public record ReservationRequested(
        UUID eventId,
        String operationKey,
        String orderId,
        List<StockItem> items
    ) {
        public ReservationRequested {
            Objects.requireNonNull(eventId, InventoryErrorMessages.EVENT_ID);
            operationKey = required(operationKey, "operationKey");
            orderId = required(orderId, "orderId");
            items = List.copyOf(items);
            if (items.isEmpty()) throw new IllegalArgumentException(InventoryErrorMessages.ITEMS_ARE_REQUIRED);
        }
    }

    public record OutgoingEvent(
        UUID eventId,
        String eventType,
        String eventVersion,
        String operationKey,
        Instant occurredAt,
        Map<String, String> payload
    ) {
        public OutgoingEvent {
            Objects.requireNonNull(eventId, InventoryErrorMessages.EVENT_ID);
            eventType = required(eventType, "eventType");
            eventVersion = required(eventVersion, "eventVersion");
            operationKey = required(operationKey, "operationKey");
            Objects.requireNonNull(occurredAt, InventoryErrorMessages.OCCURRED_AT);
            payload = Map.copyOf(payload);
        }
    }

    public record ProcessingResult(OutgoingEvent event, boolean duplicateDelivery) {}

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.required(name));
        }
        return value;
    }
}
