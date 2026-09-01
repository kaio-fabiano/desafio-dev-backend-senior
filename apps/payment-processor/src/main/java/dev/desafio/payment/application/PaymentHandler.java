package dev.desafio.payment.application;

import dev.desafio.payment.domain.Payment;

import java.time.Clock;
import java.util.Objects;
import java.util.UUID;

public final class PaymentHandler {
    private final PaymentRepository repository;
    private final PaymentProvider provider;
    private final Clock clock;

    public PaymentHandler(PaymentRepository repository, PaymentProvider provider) {
        this(repository, provider, Clock.systemUTC());
    }

    public PaymentHandler(PaymentRepository repository, PaymentProvider provider, Clock clock) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.provider = Objects.requireNonNull(provider, "provider");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public PaymentRepository.ProcessingResult handle(UUID eventId, Payment.Command command) {
        var requiredCommand = Objects.requireNonNull(command, "command");
        provider.execute(requiredCommand);
        return repository.process(
            Objects.requireNonNull(eventId, "eventId"), requiredCommand,
            clock.instant()
        );
    }
}
