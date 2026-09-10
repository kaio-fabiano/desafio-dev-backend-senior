package dev.desafio.transaction.inventory.adapter.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "inventory_inbox", schema = "inventory")
public class InventoryInboxEntity {
    @Id
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "result_event_id", nullable = false)
    private UUID resultEventId;

    @Column(name = "received_at", nullable = false, insertable = false, updatable = false)
    private Instant receivedAt;

    protected InventoryInboxEntity() {}

    public InventoryInboxEntity(UUID eventId, UUID resultEventId) {
        this.eventId = eventId;
        this.resultEventId = resultEventId;
    }
}
