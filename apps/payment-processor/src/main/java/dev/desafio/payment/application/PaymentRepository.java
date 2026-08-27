package dev.desafio.payment.application;

import dev.desafio.payment.domain.Payment;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public interface PaymentRepository {
    ProcessingResult process(UUID incomingEventId, Payment.Command command, Instant occurredAt);

    record ProcessingResult(Payment payment, Payment.OutgoingEvent outgoingEvent, boolean duplicateDelivery) {
        public ProcessingResult {
            Objects.requireNonNull(payment, "payment");
            Objects.requireNonNull(outgoingEvent, "outgoingEvent");
        }
    }
}
