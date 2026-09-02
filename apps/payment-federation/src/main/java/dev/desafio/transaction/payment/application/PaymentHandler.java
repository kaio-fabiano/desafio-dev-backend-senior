package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.Payment;

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
        Objects.requireNonNull(eventId, "eventId");
        Objects.requireNonNull(command, "command");
        var providerCommand = command instanceof Payment.RefundRequested refund
            ? refund.withProviderReference(repository.providerReference(refund))
            : command;
        var providerResult = provider.execute(providerCommand);
        return repository.process(eventId, providerCommand, providerResult, clock.instant());
    }
}
