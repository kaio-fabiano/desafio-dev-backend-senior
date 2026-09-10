package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;

final class TransactionPersistenceMapper {
    private TransactionPersistenceMapper() {}

    static CheckoutOperationRepository.Operation operation(CheckoutOperationEntity entity) {
        return new CheckoutOperationRepository.Operation(
            entity.transactionId(), entity.operationKey(), entity.subject(), entity.commandHash(),
            entity.wooReference(), entity.wooOrderId(), entity.items(), entity.amount(), entity.currency(),
            entity.status()
        );
    }

    static CheckoutOperationView checkoutView(CheckoutOperationEntity entity) {
        return new CheckoutOperationView(
            entity.transactionId(), entity.operationKey(),
            entity.status() == CheckoutOperationRepository.Status.COMPLETED ? "COMPLETED" : "PENDING"
        );
    }

    static TransactionView transactionView(TransactionViewEntity entity) {
        return new TransactionView(
            entity.transactionId(), entity.operationKey(), entity.ownerSubject(), entity.wooOrderId(),
            entity.amount(), entity.currency(), entity.paymentMethod(), entity.status(),
            entity.outcomeReference(), entity.eventVersion()
        );
    }
}
