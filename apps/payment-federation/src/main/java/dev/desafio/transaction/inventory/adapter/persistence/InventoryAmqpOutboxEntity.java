package dev.desafio.transaction.inventory.adapter.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity(name = "InventoryIntegrationOutboxEntity")
@Table(name = "amqp_outbox", schema = "inventory")
public class InventoryAmqpOutboxEntity {
    @Id
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "source_event_id", nullable = false, unique = true)
    private String sourceEventId;

    @Column(name = "routing_key", nullable = false)
    private String routingKey;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "envelope", nullable = false, columnDefinition = "jsonb")
    private JsonNode envelope;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "publication_attempts", nullable = false)
    private int publicationAttempts;

    @Column(name = "claimed_by")
    private String claimedBy;

    @Column(name = "claim_until")
    private Instant claimUntil;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "last_error")
    private String lastError;

    protected InventoryAmqpOutboxEntity() {}

    public InventoryAmqpOutboxEntity(
        UUID eventId,
        String sourceEventId,
        String routingKey,
        JsonNode envelope,
        Instant occurredAt
    ) {
        this.eventId = eventId;
        this.sourceEventId = sourceEventId;
        this.routingKey = routingKey;
        this.envelope = envelope;
        this.occurredAt = occurredAt;
    }

    public JsonNode envelope() { return envelope; }
}
