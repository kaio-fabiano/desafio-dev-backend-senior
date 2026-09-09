package dev.desafio.transaction.inventory.domain.event;

import dev.desafio.transaction.inventory.domain.StockItem;

import java.time.Instant;
import java.util.List;

public record InventoryReservedEvent(
    String inventoryReservationId,
    String transactionId,
    String orderId,
    List<StockItem> items,
    long version,
    String correlationId,
    String causationId,
    Instant occurredAt
) {
    public InventoryReservedEvent {
        items = List.copyOf(items);
    }
}
