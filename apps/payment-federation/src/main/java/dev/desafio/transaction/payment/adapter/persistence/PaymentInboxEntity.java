package dev.desafio.transaction.payment.adapter.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payment_inbox", schema = "payment")
public class PaymentInboxEntity implements Persistable<UUID> {
    @Id
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "effect_id")
    private UUID effectId;

    @Column(name = "result_event_id")
    private UUID resultEventId;

    @Column(name = "payment_id")
    private String paymentId;

    @Column(name = "received_at", nullable = false, insertable = false, updatable = false)
    private Instant receivedAt;

    @Transient
    private boolean newEntity = true;

    protected PaymentInboxEntity() {}

    public PaymentInboxEntity(UUID eventId) {
        this.eventId = eventId;
    }

    public void complete(String paymentId, UUID effectId, UUID resultEventId) {
        this.paymentId = paymentId;
        this.effectId = effectId;
        this.resultEventId = resultEventId;
    }

    public boolean completed() { return paymentId != null; }
    public String paymentId() { return paymentId; }
    public UUID resultEventId() { return resultEventId; }

    @Override
    public UUID getId() { return eventId; }

    @Override
    public boolean isNew() { return newEntity; }

    @PostLoad
    @PostPersist
    void markPersisted() { newEntity = false; }
}
