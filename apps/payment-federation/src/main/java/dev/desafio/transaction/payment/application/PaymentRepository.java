package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.Payment;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public interface PaymentRepository {
    default java.util.Optional<ProcessingResult> processed(
        UUID incomingEventId,
        Payment.Command command
    ) {
        return java.util.Optional.empty();
    }

    String providerReference(Payment.RefundRequested command);

    ProcessingResult process(
        UUID incomingEventId,
        Payment.Command command,
        PaymentProvider.Result providerResult,
        Instant occurredAt
    );

    record ProcessingResult(
        Payment payment,
        Payment.OutgoingEvent outgoingEvent,
        boolean duplicateDelivery
    ) {
        public ProcessingResult {
            Objects.requireNonNull(payment, "payment");
        }
    }
}
