package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.domain.Payment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

import java.time.Instant;

@Entity
@Table(name = "provider_notification_inbox", schema = "payment")
public class ProviderNotificationEntity implements Persistable<String> {
    @Id
    @Column(name = "provider_request_id", nullable = false)
    private String providerRequestId;

    @Column(name = "provider_reference", nullable = false)
    private String providerReference;

    @Enumerated(EnumType.STRING)
    @Column(name = "authoritative_status", nullable = false)
    private Payment.Status authoritativeStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "processing_outcome")
    private ProviderNotificationHandler.Outcome processingOutcome;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Transient
    private boolean newEntity = true;

    protected ProviderNotificationEntity() {}

    public ProviderNotificationEntity(
        String providerRequestId,
        PaymentProvider.Result state,
        Instant receivedAt
    ) {
        this.providerRequestId = providerRequestId;
        this.providerReference = state.providerReference();
        this.authoritativeStatus = state.status();
        this.receivedAt = receivedAt;
    }

    public void complete(ProviderNotificationHandler.Outcome outcome, Instant instant) {
        processingOutcome = outcome;
        processedAt = instant;
    }

    public boolean completed() { return processingOutcome != null; }

    @Override
    public String getId() { return providerRequestId; }

    @Override
    public boolean isNew() { return newEntity; }

    @PostLoad
    @PostPersist
    void markPersisted() { newEntity = false; }
}
