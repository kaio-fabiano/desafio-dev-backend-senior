package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.application.checkout.CheckoutOperationRepository;

final class TransactionPersistenceMapper {
    private TransactionPersistenceMapper() {}

    static CheckoutOperationRepository.Operation operation(CheckoutOperationEntity entity) {
        return new CheckoutOperationRepository.Operation(
            entity.operationId(), entity.operationKey(), entity.subject(), entity.commandHash(),
            entity.wooReference(), entity.wooOrderId(), entity.items(), entity.amount(), entity.currency(),
            entity.paymentId(), entity.errorReason(), entity.status()
        );
    }

    static CheckoutOperationView checkoutView(CheckoutOperationEntity entity) {
        return new CheckoutOperationView(
            entity.operationId(), entity.operationKey(),
            switch (entity.status()) {
                case COMPLETED -> "COMPLETED";
                case FAILED -> "FAILED";
                default -> "PROCESSING";
            },
            entity.wooOrderId(), entity.paymentId(), entity.errorReason(), entity.subject()
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
