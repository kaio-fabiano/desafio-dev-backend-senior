package dev.desafio.transaction.inventory.adapter.persistence;

import dev.desafio.transaction.inventory.domain.InventoryReservation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "inventory_reservation_projection", schema = "inventory")
public class InventoryReservationProjectionEntity {
    @Id
    @Column(name = "inventory_reservation_id", nullable = false)
    private String inventoryReservationId;

    @Column(name = "transaction_id", nullable = false)
    private String transactionId;

    @Column(name = "order_id", nullable = false)
    private String orderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private InventoryReservation.Status status;

    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "reason")
    private String reason;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected InventoryReservationProjectionEntity() {}

    public InventoryReservationProjectionEntity(
        String inventoryReservationId,
        String transactionId,
        String orderId,
        InventoryReservation.Status status,
        long version,
        String reason,
        Instant updatedAt
    ) {
        this.inventoryReservationId = inventoryReservationId;
        update(transactionId, orderId, status, version, reason, updatedAt);
    }

    public void update(
        String newTransactionId,
        String newOrderId,
        InventoryReservation.Status newStatus,
        long newVersion,
        String newReason,
        Instant newUpdatedAt
    ) {
        transactionId = newTransactionId;
        orderId = newOrderId;
        status = newStatus;
        version = newVersion;
        reason = newReason;
        updatedAt = newUpdatedAt;
    }

    public String inventoryReservationId() { return inventoryReservationId; }
    public String transactionId() { return transactionId; }
    public String orderId() { return orderId; }
    public InventoryReservation.Status status() { return status; }
    public long version() { return version; }
    public String reason() { return reason; }
    public Instant updatedAt() { return updatedAt; }
}
