package dev.desafio.transaction.transaction.adapter.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "amqp_outbox", schema = "transaction")
final class TransactionOutboxEntity {
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

    protected TransactionOutboxEntity() {}

    TransactionOutboxEntity(
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

    JsonNode envelope() { return envelope; }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
