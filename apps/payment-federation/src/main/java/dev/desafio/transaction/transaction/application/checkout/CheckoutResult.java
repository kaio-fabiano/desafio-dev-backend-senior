package dev.desafio.transaction.transaction.application.checkout;

public record CheckoutResult(
    String operationId,
    String status,
    String orderId,
    String paymentId,
    String errorReason
) {
    public CheckoutResult(String transactionId, String wooOrderId) {
        this(transactionId, "COMPLETED", wooOrderId, "payment:" + transactionId, null);
    }

    public String transactionId() { return operationId; }
    public String wooOrderId() { return orderId; }
}
