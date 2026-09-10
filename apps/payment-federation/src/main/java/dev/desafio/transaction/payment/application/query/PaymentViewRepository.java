package dev.desafio.transaction.payment.application.query;

import java.util.Optional;

public interface PaymentViewRepository {
    Optional<PaymentView> findByTransactionId(String transactionId);
}
