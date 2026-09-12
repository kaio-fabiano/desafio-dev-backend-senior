package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.domain.event.PaymentApproved;
import dev.desafio.transaction.payment.domain.event.PaymentPending;
import dev.desafio.transaction.payment.domain.event.PaymentRefunded;
import dev.desafio.transaction.payment.domain.event.PaymentRejected;
import dev.desafio.transaction.payment.domain.event.PaymentRequested;
import dev.desafio.transaction.payment.domain.Payment;
import org.springframework.transaction.annotation.Transactional;

@Transactional
public class JpaPaymentProjection implements PaymentProjection {
    private final SpringDataPaymentRecordRepository payments;

    public JpaPaymentProjection(SpringDataPaymentRecordRepository payments) {
        this.payments = java.util.Objects.requireNonNull(payments, "payments");
    }

    @Override
    public void project(PaymentRequested event) {
        if (payments.existsById(event.paymentId())) return;
        payments.save(PaymentRecordEntity.projection(
            event.paymentId(), event.operationKey(), event.transactionId(), event.method(),
            event.amount(), event.currency()
        ));
    }

    @Override
    public void project(PaymentPending event) {
        update(
            event.paymentId(),
            event.pixCode() == null ? Payment.Status.PENDING : Payment.Status.PIX_GENERATED,
            event.providerReference(), event.pixCode(), 2
        );
    }

    @Override
    public void project(PaymentApproved event) {
        var payment = payments.lockByPaymentId(event.paymentId())
            .orElseThrow(() -> new IllegalStateException("Payment projection has no requested event"));
        var status = payment.method() == Payment.Method.PIX ? Payment.Status.PIX_PAID : Payment.Status.AUTHORIZED;
        payment.project(status, event.providerReference(), null, 3);
    }

    @Override
    public void project(PaymentRejected event) {
        update(event.paymentId(), Payment.Status.REJECTED, event.providerReference(), null, 3);
    }

    @Override
    public void project(PaymentRefunded event) {
        update(event.paymentId(), Payment.Status.REFUNDED, event.providerReference(), null, 4);
    }

    void update(
        String paymentId,
        Payment.Status status,
        String providerReference,
        String pixCode,
        long sequence
    ) {
        var payment = payments.lockByPaymentId(paymentId)
            .orElseThrow(() -> new IllegalStateException("Payment projection has no requested event"));
        payment.project(status, providerReference, pixCode, sequence);
    }
}
