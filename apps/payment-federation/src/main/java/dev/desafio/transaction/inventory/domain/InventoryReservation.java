package dev.desafio.transaction.inventory.domain;

import dev.desafio.transaction.inventory.domain.event.InventoryCommittedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReleasedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservationRejectedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

public final class InventoryReservation {
    public static final String TAG_KEY = "inventoryReservationId";

    private String id;
    private String transactionId;
    private String orderId;
    private List<StockItem> items = List.of();
    private Status status;
    private long version;

    private InventoryReservation() {}

    public static InventoryReservation decide(
        String id,
        String transactionId,
        String orderId,
        List<StockItem> items,
        boolean available,
        String correlationId,
        String causationId,
        Instant occurredAt,
        InventoryEventPublisher events
    ) {
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("items are required");
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(events, "events");
        Object event = available
            ? new InventoryReservedEvent(
                required(id, "id"), required(transactionId, "transactionId"),
                required(orderId, "orderId"), items, 1, required(correlationId, "correlationId"),
                required(causationId, "causationId"), occurredAt
            )
            : new InventoryReservationRejectedEvent(
                required(id, "id"), required(transactionId, "transactionId"),
                required(orderId, "orderId"), items, "INSUFFICIENT_STOCK", 1,
                required(correlationId, "correlationId"), required(causationId, "causationId"), occurredAt
            );
        events.raise(event);
        return event instanceof InventoryReservedEvent reserved
            ? new InventoryReservation(reserved)
            : new InventoryReservation((InventoryReservationRejectedEvent) event);
    }

    public InventoryReservation(InventoryReservedEvent event) {
        on(event);
    }

    public InventoryReservation(InventoryReservationRejectedEvent event) {
        on(event);
    }

    public boolean commit(String correlationId, String causationId, Instant occurredAt,
                          InventoryEventPublisher events) {
        if (status == Status.COMMITTED) return false;
        if (status != Status.RESERVED) return false;
        var event = new InventoryCommittedEvent(
            id, transactionId, orderId, version + 1,
            required(correlationId, "correlationId"), required(causationId, "causationId"), occurredAt
        );
        events.raise(event);
        on(event);
        return true;
    }

    public boolean release(String correlationId, String causationId, Instant occurredAt,
                           InventoryEventPublisher events) {
        if (status == Status.RELEASED) return false;
        if (status != Status.RESERVED) return false;
        var event = new InventoryReleasedEvent(
            id, transactionId, orderId, version + 1,
            required(correlationId, "correlationId"), required(causationId, "causationId"), occurredAt
        );
        events.raise(event);
        on(event);
        return true;
    }

    public void on(InventoryReservedEvent event) {
        id = event.inventoryReservationId();
        transactionId = event.transactionId();
        orderId = event.orderId();
        items = List.copyOf(event.items());
        status = Status.RESERVED;
        version = event.version();
    }

    public void on(InventoryReservationRejectedEvent event) {
        id = event.inventoryReservationId();
        transactionId = event.transactionId();
        orderId = event.orderId();
        items = List.copyOf(event.items());
        status = Status.REJECTED;
        version = event.version();
    }

    public void on(InventoryCommittedEvent event) {
        status = Status.COMMITTED;
        version = event.version();
    }

    public void on(InventoryReleasedEvent event) {
        status = Status.RELEASED;
        version = event.version();
    }

    public String id() { return id; }
    public String transactionId() { return transactionId; }
    public String orderId() { return orderId; }
    public List<StockItem> items() { return List.copyOf(items); }
    public Status status() { return status; }
    public long version() { return version; }

    public boolean isSameRequest(String candidateOrderId, List<StockItem> candidateItems) {
        return orderId.equals(candidateOrderId) && items.equals(candidateItems);
    }

    public enum Status { RESERVED, REJECTED, COMMITTED, RELEASED }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }
}
