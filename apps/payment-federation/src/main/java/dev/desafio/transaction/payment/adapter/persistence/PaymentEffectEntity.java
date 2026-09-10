package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentProvider;
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
import java.util.UUID;

@Entity
@Table(name = "payment_effect", schema = "payment")
public class PaymentEffectEntity implements Persistable<UUID> {
    @Id
    @Column(name = "effect_id", nullable = false)
    private UUID effectId;

    @Column(name = "payment_id", nullable = false)
    private String paymentId;

    @Column(name = "operation_key", nullable = false)
    private String operationKey;

    @Column(name = "effect_type", nullable = false)
    private String effectType;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private State state;

    @Column(name = "idempotency_key")
    private String idempotencyKey;

    @Column(name = "provider_reference")
    private String providerReference;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_status")
    private Payment.Status providerStatus;

    @Column(name = "pix_code")
    private String pixCode;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Transient
    private boolean newEntity = true;

    protected PaymentEffectEntity() {}

    private PaymentEffectEntity(
        UUID effectId,
        String paymentId,
        String operationKey,
        String effectType,
        Instant occurredAt,
        State state,
        String idempotencyKey
    ) {
        this.effectId = effectId;
        this.paymentId = paymentId;
        this.operationKey = operationKey;
        this.effectType = effectType;
        this.occurredAt = occurredAt;
        this.state = state;
        this.idempotencyKey = idempotencyKey;
    }

    public static PaymentEffectEntity claimed(PaymentEffectLedger.Effect effect) {
        return new PaymentEffectEntity(
            effect.effectId(), effect.paymentId(), effect.operationKey(), effect.type().name(),
            effect.occurredAt(), State.CLAIMED, effect.operationKey()
        );
    }

    public static PaymentEffectEntity completed(
        UUID effectId,
        Payment payment,
        String effectType,
        Instant occurredAt
    ) {
        return new PaymentEffectEntity(
            effectId, payment.paymentId(), payment.operationKey(), effectType,
            occurredAt, State.COMPLETED, null
        );
    }

    public boolean hasIntent(PaymentEffectLedger.Effect effect) {
        return paymentId.equals(effect.paymentId())
            && operationKey.equals(effect.operationKey())
            && effectType.equals(effect.type().name());
    }

    public void complete(PaymentProvider.Result result, Instant instant) {
        if (state == State.COMPLETED) {
            if (!result.equals(result())) {
                throw new IllegalArgumentException("payment effect completed with another result");
            }
            return;
        }
        state = State.COMPLETED;
        providerReference = result.providerReference();
        providerStatus = result.status();
        pixCode = result.pixCode();
        completedAt = instant;
    }

    public PaymentProvider.Result result() {
        return state == State.COMPLETED && providerStatus != null
            ? new PaymentProvider.Result(providerReference, providerStatus, pixCode)
            : null;
    }

    @Override
    public UUID getId() { return effectId; }

    @Override
    public boolean isNew() { return newEntity; }

    @PostLoad
    @PostPersist
    void markPersisted() { newEntity = false; }

    enum State { CLAIMED, COMPLETED }
}
