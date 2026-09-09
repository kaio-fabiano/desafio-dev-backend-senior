package dev.desafio.transaction.transaction.application.query;

public record FindOwnedTransaction(String transactionId, String owner) {
    public FindOwnedTransaction {
        transactionId = required(transactionId, "transactionId");
        owner = required(owner, "owner");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
