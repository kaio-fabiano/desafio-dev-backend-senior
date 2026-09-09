package dev.desafio.transaction.transaction.application.command;

import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.axonframework.messaging.eventhandling.gateway.EventAppender;
import org.axonframework.modelling.annotation.InjectEntity;

import java.time.Clock;
import java.util.Objects;

public final class RecordTransactionOutcomeHandler {
    private final Clock clock;

    public RecordTransactionOutcomeHandler(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @CommandHandler
    public void handle(
        RecordTransactionOutcome command,
        @InjectEntity TransactionEventSourcedEntity transaction,
        EventAppender events
    ) {
        transaction.record(command, clock.instant()).ifPresent(events::append);
    }
}
