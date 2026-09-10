package dev.desafio.transaction.transaction.application.query;

import java.util.Optional;

public interface TransactionReadRepository {
    Optional<CheckoutOperationView> findCheckout(String id, String owner);
    Optional<TransactionView> findTransaction(String transactionId, String owner);
    Optional<TransactionView> findTransactionByWooOrder(String wooOrderId, String owner);
}
