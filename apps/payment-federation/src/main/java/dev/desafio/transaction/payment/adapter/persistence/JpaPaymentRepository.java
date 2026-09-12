package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.payment.domain.Payment;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public class JpaPaymentRepository implements PaymentRepository {
    private final SpringDataPaymentRecordRepository payments;
    private final SpringDataPaymentEffectRepository effects;
    private final SpringDataPaymentInboxRepository inbox;
    private final SpringDataPaymentOutboxRepository outbox;

    public JpaPaymentRepository(
        SpringDataPaymentRecordRepository payments,
        SpringDataPaymentEffectRepository effects,
        SpringDataPaymentInboxRepository inbox,
        SpringDataPaymentOutboxRepository outbox
    ) {
        this.payments = java.util.Objects.requireNonNull(payments, "payments");
        this.effects = java.util.Objects.requireNonNull(effects, "effects");
        this.inbox = java.util.Objects.requireNonNull(inbox, "inbox");
        this.outbox = java.util.Objects.requireNonNull(outbox, "outbox");
    }

    @Override
    @Transactional
    public Optional<ProcessingResult> processed(UUID incomingEventId, Payment.ProviderRequest command) {
        return inbox.findLockedByEventId(incomingEventId)
            .filter(PaymentInboxEntity::completed)
            .map(stored -> duplicateResult(stored, command));
    }

    @Override
    @Transactional
    public String providerReference(Payment.RefundRequested command) {
        var payment = findPayment(command.paymentId(), command.operationKey())
            .orElseThrow(() -> new IllegalStateException("authorized payment does not exist"));
        if (!payment.orderId().equals(command.orderId())
            || (payment.status() != Payment.Status.AUTHORIZED
                && payment.status() != Payment.Status.REFUNDED)) {
            throw new IllegalStateException("authorized payment does not match the refund request");
        }
        return payment.providerReference();
    }

    @Override
    @Transactional
    public ProcessingResult process(
        UUID incomingEventId,
        Payment.ProviderRequest command,
        PaymentProvider.Result providerResult,
        Instant occurredAt
    ) {
        java.util.Objects.requireNonNull(incomingEventId, "incomingEventId");
        java.util.Objects.requireNonNull(command, "command");
        java.util.Objects.requireNonNull(providerResult, "providerResult");
        java.util.Objects.requireNonNull(occurredAt, "occurredAt");

        var delivery = inbox.findLockedByEventId(incomingEventId).orElse(null);
        if (delivery != null && delivery.completed()) return duplicateResult(delivery, command);
        if (delivery == null) delivery = inbox.save(new PaymentInboxEntity(incomingEventId));

        var payment = command instanceof Payment.PaymentRequested requested
            ? processRequest(requested, providerResult)
            : processRefund((Payment.RefundRequested) command, providerResult);
        var event = Payment.resultEvent(payment, occurredAt);
        UUID effectId = null;
        if (event != null) {
            effectId = Payment.stableUuid(payment.operationKey(), payment.paymentId(), effectType(payment.status()));
            if (!effects.existsById(effectId)) {
                effects.save(PaymentEffectEntity.completed(
                    effectId, payment, effectType(payment.status()), occurredAt
                ));
            }
            var storedEvent = outbox.findByEffectId(effectId).orElse(null);
            if (storedEvent == null) {
                storedEvent = outbox.save(new PaymentOutboxEntity(effectId, event));
            }
            event = storedEvent.toDomain();
        }
        delivery.complete(payment.paymentId(), effectId, event == null ? null : event.eventId());
        return new ProcessingResult(payment, event, false);
    }

    private Payment processRequest(
        Payment.PaymentRequested command,
        PaymentProvider.Result providerResult
    ) {
        var proposed = Payment.fromProvider(command, providerResult.toDomainResult());
        var stored = findPayment(command.paymentId(), command.operationKey());
        if (stored.isEmpty()) {
            payments.saveAndFlush(PaymentRecordEntity.from(proposed));
            return proposed;
        }
        var payment = stored.orElseThrow();
        if (!payment.hasSameIdentity(proposed)) {
            throw new IllegalArgumentException("operationKey and paymentId identify a different payment");
        }
        if (payment.status() == Payment.Status.PENDING && proposed.status() != Payment.Status.PENDING) {
            payments.getReferenceById(payment.paymentId()).transition(
                proposed.status(), proposed.providerReference(), proposed.pixCode()
            );
            return proposed;
        }
        return payment;
    }

    private Payment processRefund(
        Payment.RefundRequested command,
        PaymentProvider.Result providerResult
    ) {
        var entity = findPaymentEntity(command.paymentId(), command.operationKey())
            .orElseThrow(() -> new IllegalStateException("authorized payment does not exist"));
        var stored = entity.toDomain();
        var refunded = stored.refund(command, providerResult.toDomainResult());
        if (stored.status() == Payment.Status.AUTHORIZED) {
            entity.transition(refunded.status(), refunded.providerReference(), refunded.pixCode());
        }
        return refunded;
    }

    private Optional<Payment> findPayment(String paymentId, String operationKey) {
        return findPaymentEntity(paymentId, operationKey).map(PaymentRecordEntity::toDomain);
    }

    private Optional<PaymentRecordEntity> findPaymentEntity(String paymentId, String operationKey) {
        var matches = payments.lockByPaymentIdOrOperationKey(paymentId, operationKey);
        if (matches.size() > 1) {
            throw new IllegalArgumentException("paymentId and operationKey identify different payments");
        }
        if (matches.isEmpty()) return Optional.empty();
        var match = matches.getFirst();
        if (!match.paymentId().equals(paymentId) || !match.operationKey().equals(operationKey)) {
            throw new IllegalArgumentException("paymentId and operationKey identify different payments");
        }
        return Optional.of(match);
    }

    private ProcessingResult duplicateResult(PaymentInboxEntity delivery, Payment.ProviderRequest command) {
        var payment = findPayment(command.paymentId(), command.operationKey())
            .orElseThrow(() -> new IllegalStateException("claimed payment inbox record is incomplete"));
        var event = delivery.resultEventId() == null
            ? null
            : outbox.findById(delivery.resultEventId())
                .orElseThrow(() -> new IllegalStateException("claimed payment result is incomplete"))
                .toDomain();
        return new ProcessingResult(payment, event, true);
    }

    private String effectType(Payment.Status status) {
        return switch (status) {
            case AUTHORIZED -> "CARD_AUTHORIZATION";
            case PIX_GENERATED -> "PIX_CODE_GENERATION";
            case PIX_PAID -> "PIX_PAYMENT_CONFIRMATION";
            case REFUNDED -> "REFUND";
            case REJECTED -> "PAYMENT_REJECTION";
            case PENDING -> throw new IllegalArgumentException("pending payments have no effect");
        };
    }
}
