package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.domain.Payment;

import java.math.BigDecimal;
import java.util.Objects;

public record AuthorizePayment(
    String operationKey,
    String paymentId,
    String orderId,
    Payment.Method method,
    BigDecimal amount,
    String currency,
    String providerToken,
    String payerEmail,
    String paymentMethodId
) {
    public AuthorizePayment {
        operationKey = required(operationKey, "operationKey");
        paymentId = required(paymentId, "paymentId");
        orderId = required(orderId, "orderId");
        Objects.requireNonNull(method, "method");
        Objects.requireNonNull(amount, "amount");
        currency = required(currency, "currency");
        payerEmail = required(payerEmail, "payerEmail");

        if (method == Payment.Method.CARD) {
            providerToken = required(providerToken, "providerToken");
            paymentMethodId = required(paymentMethodId, "paymentMethodId");
        } else if (hasText(providerToken) || hasText(paymentMethodId)) {
            throw new IllegalArgumentException("Pix payments do not accept Card provider fields");
        }
    }

    public Payment.PaymentRequested toDomainCommand() {
        return new Payment.PaymentRequested(
            operationKey,
            paymentId,
            orderId,
            method,
            amount,
            currency,
            providerToken,
            payerEmail,
            paymentMethodId
        );
    }

    private static String required(String value, String name) {
        if (!hasText(value)) throw new IllegalArgumentException(name + " is required");
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
