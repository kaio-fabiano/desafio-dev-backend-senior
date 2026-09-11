package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.application.axon.PaymentAggregate;
import dev.desafio.transaction.payment.application.command.RecordPaymentOutcome;
import dev.desafio.transaction.payment.application.command.RecordProviderNotification;
import dev.desafio.transaction.payment.application.command.RefundPayment;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.axonframework.messaging.eventhandling.gateway.EventAppender;
import org.axonframework.modelling.annotation.InjectEntity;

import java.time.Clock;
import java.util.Optional;

public final class PaymentCommandHandler {
    private final Clock clock;

    public PaymentCommandHandler(Clock clock) {
        this.clock = java.util.Objects.requireNonNull(clock, "clock");
    }

    @CommandHandler
    public String handle(
        RequestPayment command,
        @InjectEntity Optional<PaymentAggregate> existing,
        EventAppender events
    ) {
        if (existing.isPresent()) {
            existing.orElseThrow().assertSameIntent(command);
            return command.paymentId();
        }
        events.append(PaymentAggregate.request(command, clock.instant()));
        return command.paymentId();
    }

    @CommandHandler
    public void handle(
        RecordPaymentOutcome command,
        @InjectEntity PaymentAggregate payment,
        EventAppender events
    ) {
        var event = payment.record(command, clock.instant());
        if (event != null) events.append(event);
    }

    @CommandHandler
    public void handle(
        RecordProviderNotification command,
        @InjectEntity PaymentAggregate payment,
        EventAppender events
    ) {
        var event = payment.record(new RecordPaymentOutcome(
            command.paymentId(), command.providerReference(), command.status(), command.pixCode(),
            command.providerRequestId(), command.providerRequestId()
        ), clock.instant());
        if (event != null) events.append(event);
    }

    @CommandHandler
    public void handle(
        RefundPayment command,
        @InjectEntity PaymentAggregate payment,
        EventAppender events
    ) {
        var event = payment.refund(command, clock.instant());
        if (event != null) events.append(event);
    }
}
