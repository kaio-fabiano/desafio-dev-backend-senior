package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.util.Objects;

@Command(namespace = "payment", name = "RecordPaymentOutcome", version = "1.0.0")
public record RecordPaymentOutcome(
    @TargetEntityId String paymentId,
    String providerReference,
    Payment.Status status,
    String pixCode,
    String correlationId,
    String causationId
) {
    public RecordPaymentOutcome {
        if (paymentId == null || paymentId.isBlank()) throw new IllegalArgumentException(PaymentErrorMessages.required("paymentId"));
        if (providerReference == null || providerReference.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required("providerReference"));
        }
        Objects.requireNonNull(status, "status");
        if (correlationId == null || correlationId.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required("correlationId"));
        }
        if (causationId == null || causationId.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required("causationId"));
        }
    }
}
