package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Comparator;
import java.util.Objects;
import java.util.UUID;

@MappedSuperclass
public abstract class AmqpInboxEntity {
    private static final Comparator<JsonNode> JSONB_EQUALITY = (left, right) -> {
        if (left.isNumber() && right.isNumber()) {
            return left.decimalValue().compareTo(right.decimalValue());
        }
        return left.equals(right) ? 0 : 1;
    };

    @EmbeddedId
    private AmqpInboxId id;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "correlation_id", nullable = false)
    private String correlationId;

    @Column(name = "causation_id", nullable = false)
    private String causationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "envelope", nullable = false, columnDefinition = "jsonb")
    private JsonNode envelope;

    @Enumerated(EnumType.STRING)
    @Column(name = "disposition", nullable = false)
    private InboxStore.Disposition disposition;

    @Column(name = "received_at", nullable = false, insertable = false, updatable = false)
    private Instant receivedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected AmqpInboxEntity() {}

    protected AmqpInboxEntity(
        String consumer,
        UUID eventId,
        String eventType,
        String correlationId,
        String causationId,
        JsonNode envelope
    ) {
        id = new AmqpInboxId(consumer, eventId);
        this.eventType = required(eventType, "eventType");
        this.correlationId = required(correlationId, "correlationId");
        this.causationId = required(causationId, "causationId");
        this.envelope = Objects.requireNonNull(envelope, "envelope");
        disposition = InboxStore.Disposition.PROCESSING;
    }

    boolean hasSameEnvelope(JsonNode candidate) {
        return envelope.equals(JSONB_EQUALITY, candidate);
    }

    boolean isProcessing() {
        return disposition == InboxStore.Disposition.PROCESSING;
    }

    void complete(InboxStore.Disposition completedDisposition, Instant completedAt) {
        if (completedDisposition == InboxStore.Disposition.PROCESSING) {
            throw new IllegalArgumentException("processing is not a completed disposition");
        }
        disposition = Objects.requireNonNull(completedDisposition, "completedDisposition");
        this.completedAt = Objects.requireNonNull(completedAt, "completedAt");
    }

    String dispositionName() {
        return disposition.name();
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
