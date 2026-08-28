package dev.desafio.payment.application.query;

import dev.desafio.payment.domain.Payment;

import java.math.BigDecimal;

public record PaymentView(
    String id,
    String operationKey,
    String orderId,
    Payment.Method method,
    BigDecimal amount,
    String currency,
    Payment.Status status,
    String pixCode
) {
    public static PaymentView from(Payment payment) {
        return new PaymentView(
            payment.paymentId(), payment.operationKey(), payment.orderId(), payment.method(), payment.amount(),
            payment.currency(), payment.status(), payment.pixCode()
        );
    }
}
