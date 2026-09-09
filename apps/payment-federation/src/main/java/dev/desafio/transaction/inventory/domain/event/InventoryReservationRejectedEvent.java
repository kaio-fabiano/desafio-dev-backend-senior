package dev.desafio.transaction.inventory.domain.event;

import dev.desafio.transaction.inventory.domain.StockItem;
import java.time.Instant;
import java.util.List;

public record InventoryReservationRejectedEvent(
    String inventoryReservationId,
    String transactionId,
    String orderId,
    List<StockItem> items,
    String reason,
    long version,
    String correlationId,
    String causationId,
    Instant occurredAt
) {
    public InventoryReservationRejectedEvent {
        items = List.copyOf(items);
    }
}
