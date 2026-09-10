package dev.desafio.transaction.payment.application.query;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;

public record FindPaymentByTransaction(String transactionId) {
    public FindPaymentByTransaction {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required("transactionId"));
        }
    }
}
