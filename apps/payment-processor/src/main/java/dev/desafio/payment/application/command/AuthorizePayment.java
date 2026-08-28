package dev.desafio.payment.application.command;

import dev.desafio.payment.domain.Payment;

import java.math.BigDecimal;

public record AuthorizePayment(
    String operationKey,
    String paymentId,
    String orderId,
    Payment.Method method,
    BigDecimal amount,
    String currency
) {
    Payment.PaymentRequested toDomainCommand() {
        return new Payment.PaymentRequested(operationKey, paymentId, orderId, method, amount, currency);
    }
}
