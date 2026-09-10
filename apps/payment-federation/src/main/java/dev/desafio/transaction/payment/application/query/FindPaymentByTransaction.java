package dev.desafio.transaction.payment.application.query;

public record FindPaymentByTransaction(String transactionId) {
    public FindPaymentByTransaction {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("transactionId is required");
        }
    }
}
