package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.util.Objects;

@Command(namespace = "payment", name = "RecordProviderNotification", version = "1.0.0")
public record RecordProviderNotification(
    @TargetEntityId String paymentId,
    String providerRequestId,
    String providerReference,
    Payment.Status status,
    String pixCode
) {
    public RecordProviderNotification {
        paymentId = required(paymentId, "paymentId");
        providerRequestId = required(providerRequestId, "providerRequestId");
        providerReference = required(providerReference, "providerReference");
        Objects.requireNonNull(status, "status");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(PaymentErrorMessages.required(name));
        return value;
    }
}
