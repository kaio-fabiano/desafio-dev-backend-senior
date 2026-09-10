package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Comparator;
import java.util.Objects;
import java.util.UUID;

@MappedSuperclass
public abstract class AmqpOutboxEntity {
    private static final Comparator<JsonNode> JSONB_EQUALITY = (left, right) -> {
        if (left.isNumber() && right.isNumber()) {
            return left.decimalValue().compareTo(right.decimalValue());
        }
        return left.equals(right) ? 0 : 1;
    };

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

    protected AmqpOutboxEntity() {}

    protected AmqpOutboxEntity(
        UUID eventId,
        String sourceEventId,
        String routingKey,
        JsonNode envelope,
        Instant occurredAt
    ) {
        this.eventId = Objects.requireNonNull(eventId, "eventId");
        this.sourceEventId = required(sourceEventId, "sourceEventId");
        this.routingKey = required(routingKey, "routingKey");
        this.envelope = Objects.requireNonNull(envelope, "envelope");
        this.occurredAt = Objects.requireNonNull(occurredAt, "occurredAt");
    }

    void claim(String relayId, Instant claimUntil) {
        claimedBy = required(relayId, "relayId");
        this.claimUntil = Objects.requireNonNull(claimUntil, "claimUntil");
        publicationAttempts++;
    }

    boolean markPublished(String relayId, Instant publishedAt) {
        if (!isOwnedBy(relayId)) return false;
        this.publishedAt = Objects.requireNonNull(publishedAt, "publishedAt");
        claimedBy = null;
        claimUntil = null;
        lastError = null;
        return true;
    }

    boolean release(String relayId, Exception error) {
        if (!isOwnedBy(relayId)) return false;
        claimedBy = null;
        claimUntil = null;
        lastError = Objects.requireNonNull(error, "error").getClass().getName();
        return true;
    }

    boolean hasSameEnvelope(JsonNode candidate) {
        return envelope.equals(JSONB_EQUALITY, candidate);
    }

    UUID eventId() { return eventId; }

    String routingKey() { return routingKey; }

    JsonNode envelope() { return envelope; }

    public int publicationAttempts() { return publicationAttempts; }

    private boolean isOwnedBy(String relayId) {
        return publishedAt == null && Objects.equals(claimedBy, relayId);
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
