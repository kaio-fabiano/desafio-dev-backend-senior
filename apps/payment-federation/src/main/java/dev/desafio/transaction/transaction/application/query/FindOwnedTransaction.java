package dev.desafio.transaction.transaction.application.query;

import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;

public record FindOwnedTransaction(String transactionId, String owner) {
    public FindOwnedTransaction {
        transactionId = required(transactionId, "transactionId");
        owner = required(owner, "owner");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(TransactionErrorMessages.required(name));
        }
        return value;
    }
}
