package dev.desafio.payment.application;

import dev.desafio.payment.domain.Payment;

import java.time.Clock;
import java.util.Objects;
import java.util.UUID;

public final class PaymentHandler {
    private final PaymentRepository repository;
    private final Clock clock;

    public PaymentHandler(PaymentRepository repository) {
        this(repository, Clock.systemUTC());
    }

    public PaymentHandler(PaymentRepository repository, Clock clock) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public PaymentRepository.ProcessingResult handle(UUID eventId, Payment.Command command) {
        return repository.process(
            Objects.requireNonNull(eventId, "eventId"),
            Objects.requireNonNull(command, "command"),
            clock.instant()
        );
    }
}
