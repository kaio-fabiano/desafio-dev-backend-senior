package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.domain.Payment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "payment_outbox", schema = "payment")
public class PaymentOutboxEntity implements Persistable<UUID> {
    @Id
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "effect_id", nullable = false, unique = true)
    private UUID effectId;

    @Column(name = "operation_key", nullable = false)
    private String operationKey;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "event_version", nullable = false)
    private String eventVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, String> payload;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "publication_attempts", nullable = false)
    private int publicationAttempts;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Transient
    private boolean newEntity = true;

    protected PaymentOutboxEntity() {}

    public PaymentOutboxEntity(UUID effectId, Payment.OutgoingEvent event) {
        this.eventId = event.eventId();
        this.effectId = effectId;
        this.operationKey = event.operationKey();
        this.eventType = event.eventType();
        this.eventVersion = event.eventVersion();
        this.payload = event.payload();
        this.occurredAt = event.occurredAt();
    }

    public Payment.OutgoingEvent toDomain() {
        return new Payment.OutgoingEvent(
            eventId, eventType, eventVersion, operationKey, occurredAt, payload
        );
    }

    @Override
    public UUID getId() { return eventId; }

    @Override
    public boolean isNew() { return newEntity; }

    @PostLoad
    @PostPersist
    void markPersisted() { newEntity = false; }
}
