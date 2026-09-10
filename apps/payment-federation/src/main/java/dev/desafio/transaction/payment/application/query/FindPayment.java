package dev.desafio.transaction.payment.application.query;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;

public record FindPayment(String paymentId) {
    public FindPayment {
        if (paymentId == null || paymentId.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required("paymentId"));
        }
    }
}
