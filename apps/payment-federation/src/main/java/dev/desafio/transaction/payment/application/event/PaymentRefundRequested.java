package dev.desafio.transaction.payment.application.event;

import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

import java.time.Instant;

@Event(namespace = "payment", name = "PaymentRefundRequested", version = "1.0.0")
public record PaymentRefundRequested(
    @EventTag String paymentId,
    String operationKey,
    String transactionId,
    String providerReference,
    String reason,
    String correlationId,
    String causationId,
    Instant occurredAt
) {
    public Payment.RefundRequested providerCommand() {
        return new Payment.RefundRequested(
            operationKey, paymentId, transactionId, reason, providerReference
        );
    }
}
