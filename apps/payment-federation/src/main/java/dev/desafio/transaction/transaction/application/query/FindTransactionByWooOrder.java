package dev.desafio.transaction.transaction.application.query;

import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;

public record FindTransactionByWooOrder(String wooOrderId, String owner) {
    public FindTransactionByWooOrder {
        wooOrderId = required(wooOrderId, "wooOrderId");
        owner = required(owner, "owner");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(TransactionErrorMessages.required(name));
        }
        return value;
    }
}
