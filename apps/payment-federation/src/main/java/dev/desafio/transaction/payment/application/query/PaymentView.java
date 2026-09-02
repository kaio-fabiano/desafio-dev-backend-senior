package dev.desafio.transaction.payment.application.query;

import dev.desafio.transaction.payment.domain.Payment;

import java.math.BigDecimal;

public record PaymentView(
    String id,
    String operationKey,
    String orderId,
    Payment.Method method,
    BigDecimal amount,
    String currency,
    Payment.Status status,
    String providerReference,
    String pixCode
) {
    public static PaymentView from(Payment payment) {
        return new PaymentView(
            payment.paymentId(),
            payment.operationKey(),
            payment.orderId(),
            payment.method(),
            payment.amount(),
            payment.currency(),
            payment.status(),
            payment.providerReference(),
            payment.pixCode()
        );
    }
}
