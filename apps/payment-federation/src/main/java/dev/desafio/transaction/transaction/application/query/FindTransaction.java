package dev.desafio.transaction.transaction.application.query;

import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;

public record FindTransaction(String transactionId) {
    public FindTransaction {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException(TransactionErrorMessages.TRANSACTION_ID_REQUIRED);
        }
    }
}
