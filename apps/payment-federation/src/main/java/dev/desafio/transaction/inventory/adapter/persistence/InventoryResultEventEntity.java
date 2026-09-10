package dev.desafio.transaction.inventory.adapter.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "inventory_outbox", schema = "inventory")
public class InventoryResultEventEntity {
    @Id
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "operation_key", nullable = false, unique = true)
    private String operationKey;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "event_version", nullable = false)
    private String eventVersion;

    @Column(name = "order_id", nullable = false)
    private String orderId;

    @Column(name = "reservation_id")
    private String reservationId;

    @Column(name = "reason")
    private String reason;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected InventoryResultEventEntity() {}

    public InventoryResultEventEntity(
        UUID eventId,
        String operationKey,
        String eventType,
        String eventVersion,
        String orderId,
        String reservationId,
        String reason,
        Instant occurredAt
    ) {
        this.eventId = eventId;
        this.operationKey = operationKey;
        this.eventType = eventType;
        this.eventVersion = eventVersion;
        this.orderId = orderId;
        this.reservationId = reservationId;
        this.reason = reason;
        this.occurredAt = occurredAt;
    }

    public UUID eventId() { return eventId; }
    public String operationKey() { return operationKey; }
    public String eventType() { return eventType; }
    public String eventVersion() { return eventVersion; }
    public String orderId() { return orderId; }
    public String reservationId() { return reservationId; }
    public String reason() { return reason; }
    public Instant occurredAt() { return occurredAt; }
}
