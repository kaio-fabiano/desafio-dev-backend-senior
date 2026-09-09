package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.math.BigDecimal;
import java.util.Objects;

@Command(namespace = "payment", name = "RequestPayment", version = "1.0.0")
public record RequestPayment(
    @TargetEntityId String paymentId,
    String operationKey,
    String transactionId,
    Payment.Method method,
    BigDecimal amount,
    String currency,
    String providerToken,
    String payerEmail,
    String paymentMethodId,
    String correlationId,
    String causationId
) {
    public RequestPayment {
        paymentId = required(paymentId, "paymentId");
        operationKey = required(operationKey, "operationKey");
        transactionId = required(transactionId, "transactionId");
        Objects.requireNonNull(method, "method");
        Objects.requireNonNull(amount, "amount");
        if (amount.signum() <= 0) throw new IllegalArgumentException("amount must be positive");
        currency = required(currency, "currency").toUpperCase(java.util.Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("currency must be ISO-4217");
        payerEmail = required(payerEmail, "payerEmail");
        correlationId = required(correlationId, "correlationId");
        causationId = required(causationId, "causationId");
        if (method == Payment.Method.CARD) {
            providerToken = required(providerToken, "providerToken");
            paymentMethodId = required(paymentMethodId, "paymentMethodId");
        } else if (hasText(providerToken) || hasText(paymentMethodId)) {
            throw new IllegalArgumentException("Pix payments do not accept Card provider fields");
        }
    }

    public Payment.PaymentRequested providerCommand() {
        return new Payment.PaymentRequested(
            operationKey, paymentId, transactionId, method, amount, currency,
            providerToken, payerEmail, paymentMethodId
        );
    }

    private static String required(String value, String field) {
        if (!hasText(value)) throw new IllegalArgumentException(field + " is required");
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
