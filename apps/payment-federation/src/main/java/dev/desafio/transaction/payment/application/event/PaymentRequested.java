package dev.desafio.transaction.payment.application.event;

import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

import java.math.BigDecimal;
import java.time.Instant;

@Event(namespace = "payment", name = "PaymentRequested", version = "1.0.0")
public record PaymentRequested(
    @EventTag String paymentId,
    String operationKey,
    String transactionId,
    Payment.Method method,
    BigDecimal amount,
    String currency,
    String providerToken,
    String payerEmail,
    String paymentMethodId,
    String correlationId,
    String causationId,
    Instant occurredAt
) {
    public static PaymentRequested from(RequestPayment command, Instant occurredAt) {
        return new PaymentRequested(
            command.paymentId(), command.operationKey(), command.transactionId(), command.method(),
            command.amount(), command.currency(), command.providerToken(), command.payerEmail(),
            command.paymentMethodId(), command.correlationId(), command.causationId(), occurredAt
        );
    }

    public Payment.PaymentRequested providerCommand() {
        return new Payment.PaymentRequested(
            operationKey, paymentId, transactionId, method, amount, currency,
            providerToken, payerEmail, paymentMethodId
        );
    }
}
