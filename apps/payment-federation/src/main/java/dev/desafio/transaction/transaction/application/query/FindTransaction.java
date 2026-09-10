package dev.desafio.transaction.transaction.application.query;

public record FindTransaction(String transactionId) {
    public FindTransaction {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("transactionId is required");
        }
    }
}
