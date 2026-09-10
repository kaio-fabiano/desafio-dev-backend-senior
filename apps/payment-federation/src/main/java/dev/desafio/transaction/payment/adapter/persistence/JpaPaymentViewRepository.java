package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.payment.application.query.PaymentViewRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public class JpaPaymentViewRepository implements PaymentViewRepository {
    private final SpringDataPaymentRecordRepository payments;

    public JpaPaymentViewRepository(SpringDataPaymentRecordRepository payments) {
        this.payments = java.util.Objects.requireNonNull(payments, "payments");
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PaymentView> findByTransactionId(String transactionId) {
        return payments.findByTransactionId(transactionId).map(PaymentRecordEntity::toView);
    }

    @Transactional(readOnly = true)
    public Optional<PaymentView> findByPaymentId(String paymentId) {
        return payments.findById(paymentId).map(PaymentRecordEntity::toView);
    }
}
