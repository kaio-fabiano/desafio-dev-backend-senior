package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.application.query.TransactionView;

import java.util.Optional;

public final class JpaTransactionReadRepository implements TransactionReadRepository {
    private final CheckoutOperationJpaRepository checkouts;
    private final TransactionViewJpaRepository transactions;

    public JpaTransactionReadRepository(
        CheckoutOperationJpaRepository checkouts,
        TransactionViewJpaRepository transactions
    ) {
        this.checkouts = checkouts;
        this.transactions = transactions;
    }

    @Override
    public Optional<CheckoutOperationView> findCheckout(String id, String owner) {
        return checkouts.findByTransactionIdAndSubject(id, owner)
            .map(TransactionPersistenceMapper::checkoutView);
    }

    @Override
    public Optional<TransactionView> findTransaction(String transactionId, String owner) {
        return transactions.findByTransactionIdAndOwnerSubject(transactionId, owner)
            .map(TransactionPersistenceMapper::transactionView);
    }

    @Override
    public Optional<TransactionView> findTransactionByWooOrder(String wooOrderId, String owner) {
        return transactions.findByWooOrderIdAndOwnerSubject(wooOrderId, owner)
            .map(TransactionPersistenceMapper::transactionView);
    }
}
