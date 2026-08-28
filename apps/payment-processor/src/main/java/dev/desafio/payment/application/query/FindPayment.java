package dev.desafio.payment.application.query;

public record FindPayment(String paymentId) {
    public FindPayment {
        if (paymentId == null || paymentId.isBlank()) {
            throw new IllegalArgumentException("paymentId is required");
        }
    }
}
