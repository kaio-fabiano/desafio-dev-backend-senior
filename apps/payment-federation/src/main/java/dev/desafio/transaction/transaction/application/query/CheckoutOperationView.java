package dev.desafio.transaction.transaction.application.query;

public record CheckoutOperationView(
    String id,
    String operationKey,
    String status,
    String orderId,
    String paymentId,
    String errorReason,
    String owner
) {
    public CheckoutOperationView(String id, String operationKey, String status, String orderId, String paymentId, String errorReason) {
        this(id, operationKey, status, orderId, paymentId, errorReason, null);
    }
}
