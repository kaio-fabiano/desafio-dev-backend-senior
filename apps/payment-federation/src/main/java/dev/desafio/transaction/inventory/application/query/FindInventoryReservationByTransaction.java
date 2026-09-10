package dev.desafio.transaction.inventory.application.query;

public record FindInventoryReservationByTransaction(String transactionId) {
    public FindInventoryReservationByTransaction {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("transactionId is required");
        }
    }
}
