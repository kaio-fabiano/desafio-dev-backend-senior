package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.domain.Payment;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Transactional
public class JpaProviderNotificationRepository
    implements ProviderNotificationHandler.Repository {

    private final SpringDataProviderNotificationRepository notifications;
    private final SpringDataPaymentRecordRepository payments;
    private final SpringDataPaymentEffectRepository effects;
    private final SpringDataPaymentOutboxRepository outbox;

    public JpaProviderNotificationRepository(
        SpringDataProviderNotificationRepository notifications,
        SpringDataPaymentRecordRepository payments,
        SpringDataPaymentEffectRepository effects,
        SpringDataPaymentOutboxRepository outbox
    ) {
        this.notifications = java.util.Objects.requireNonNull(notifications, "notifications");
        this.payments = java.util.Objects.requireNonNull(payments, "payments");
        this.effects = java.util.Objects.requireNonNull(effects, "effects");
        this.outbox = java.util.Objects.requireNonNull(outbox, "outbox");
    }

    @Override
    public ProviderNotificationHandler.Outcome apply(
        String providerRequestId,
        PaymentProvider.Result authoritativeState,
        Instant receivedAt
    ) {
        java.util.Objects.requireNonNull(authoritativeState, "authoritativeState");
        java.util.Objects.requireNonNull(receivedAt, "receivedAt");
        if (notifications.findLockedByProviderRequestId(providerRequestId).isPresent()) {
            return ProviderNotificationHandler.Outcome.DUPLICATE;
        }
        var notification = notifications.save(
            new ProviderNotificationEntity(providerRequestId, authoritativeState, receivedAt)
        );
        var payment = payment(authoritativeState.providerReference());
        var target = authoritativeState.status();
        ProviderNotificationHandler.Outcome outcome;
        if (payment.status() == target) {
            outcome = ProviderNotificationHandler.Outcome.NO_CHANGE;
        } else if (!isMonotonicTransition(payment, target)) {
            outcome = ProviderNotificationHandler.Outcome.IGNORED;
        } else {
            payment.transition(target, authoritativeState.providerReference(), authoritativeState.pixCode());
            persistResult(payment.toDomain(), receivedAt);
            outcome = ProviderNotificationHandler.Outcome.APPLIED;
        }
        notification.complete(outcome, receivedAt);
        return outcome;
    }

    @Override
    public ProviderNotificationHandler.Claim claimForAxon(
        String providerRequestId,
        PaymentProvider.Result authoritativeState,
        Instant receivedAt
    ) {
        java.util.Objects.requireNonNull(authoritativeState, "authoritativeState");
        java.util.Objects.requireNonNull(receivedAt, "receivedAt");
        var existing = notifications.findLockedByProviderRequestId(providerRequestId);
        var notification = existing.orElseGet(() -> notifications.save(
            new ProviderNotificationEntity(providerRequestId, authoritativeState, receivedAt)
        ));
        var payment = payment(authoritativeState.providerReference());
        return new ProviderNotificationHandler.Claim(payment.paymentId(), notification.completed());
    }

    @Override
    public void completeForAxon(
        String providerRequestId,
        ProviderNotificationHandler.Outcome outcome,
        Instant processedAt
    ) {
        notifications.findLockedByProviderRequestId(providerRequestId)
            .orElseThrow(() -> new IllegalStateException("provider notification claim is missing"))
            .complete(outcome, processedAt);
    }

    private PaymentRecordEntity payment(String providerReference) {
        return payments.lockByProviderReference(providerReference)
            .orElseThrow(() -> new IllegalStateException(
                "provider notification does not match a stored payment"
            ));
    }

    private boolean isMonotonicTransition(PaymentRecordEntity payment, Payment.Status target) {
        if (payment.status() == Payment.Status.PENDING) {
            return switch (payment.method()) {
                case CARD -> target == Payment.Status.AUTHORIZED || target == Payment.Status.REJECTED;
                case PIX -> target == Payment.Status.PIX_GENERATED || target == Payment.Status.REJECTED;
            };
        }
        if (payment.status() == Payment.Status.PIX_GENERATED) {
            return target == Payment.Status.PIX_PAID || target == Payment.Status.REJECTED;
        }
        return payment.status() == Payment.Status.AUTHORIZED && target == Payment.Status.REFUNDED;
    }

    private void persistResult(Payment payment, Instant occurredAt) {
        var event = Payment.resultEvent(payment, occurredAt);
        var effectType = effectType(payment.status());
        var effectId = Payment.stableUuid(payment.operationKey(), payment.paymentId(), effectType);
        effects.findById(effectId).orElseGet(() -> effects.save(
            PaymentEffectEntity.completed(effectId, payment, effectType, occurredAt)
        ));
        outbox.findByEffectId(effectId).orElseGet(() -> outbox.save(
            new PaymentOutboxEntity(effectId, event)
        ));
    }

    private String effectType(Payment.Status status) {
        return switch (status) {
            case AUTHORIZED -> "CARD_AUTHORIZATION";
            case PIX_GENERATED -> "PIX_CODE_GENERATION";
            case PIX_PAID -> "PIX_PAYMENT_CONFIRMATION";
            case REFUNDED -> "REFUND";
            case REJECTED -> "PAYMENT_REJECTION";
            case PENDING -> throw new IllegalArgumentException("status does not produce a payment effect");
        };
    }
}
