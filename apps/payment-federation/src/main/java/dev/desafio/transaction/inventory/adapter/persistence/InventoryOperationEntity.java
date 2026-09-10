package dev.desafio.transaction.inventory.adapter.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "inventory_operation", schema = "inventory")
public class InventoryOperationEntity {
    @Id
    @Column(name = "operation_key", nullable = false)
    private String operationKey;

    @Column(name = "order_id", nullable = false)
    private String orderId;

    @Column(name = "request_fingerprint", nullable = false)
    private String requestFingerprint;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false)
    private State state;

    @Column(name = "owner_token")
    private UUID ownerToken;

    @Column(name = "lease_until")
    private Instant leaseUntil;

    @Column(name = "result_event_id")
    private UUID resultEventId;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected InventoryOperationEntity() {}

    public InventoryOperationEntity(
        String operationKey,
        String orderId,
        String requestFingerprint,
        UUID ownerToken,
        Instant leaseUntil,
        Instant now
    ) {
        this.operationKey = operationKey;
        this.orderId = orderId;
        this.requestFingerprint = requestFingerprint;
        this.state = State.CLAIMED;
        this.ownerToken = ownerToken;
        this.leaseUntil = leaseUntil;
        this.updatedAt = now;
    }

    public void reclaim(UUID newOwnerToken, Instant newLeaseUntil, Instant now) {
        ownerToken = newOwnerToken;
        leaseUntil = newLeaseUntil;
        updatedAt = now;
    }

    public void complete(UUID eventId, Instant now) {
        state = State.COMPLETED;
        ownerToken = null;
        leaseUntil = null;
        resultEventId = eventId;
        updatedAt = now;
    }

    public String operationKey() { return operationKey; }
    public String orderId() { return orderId; }
    public String requestFingerprint() { return requestFingerprint; }
    public State state() { return state; }
    public UUID ownerToken() { return ownerToken; }
    public Instant leaseUntil() { return leaseUntil; }
    public UUID resultEventId() { return resultEventId; }

    public enum State { CLAIMED, COMPLETED }
}
