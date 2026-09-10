package dev.desafio.transaction.transaction.application.command;

import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.axonframework.messaging.eventhandling.gateway.EventAppender;
import org.axonframework.modelling.annotation.InjectEntity;

import java.time.Clock;
import java.util.Objects;
import java.util.Optional;

public final class StartTransactionHandler {
    private final Clock clock;

    public StartTransactionHandler(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @CommandHandler
    public String handle(
        StartTransaction command,
        @InjectEntity Optional<TransactionEventSourcedEntity> existing,
        EventAppender events
    ) {
        if (existing.isPresent()) {
            if (!existing.orElseThrow().matches(command)) {
                throw new IllegalArgumentException("transactionId identifies a different checkout");
            }
            return command.transactionId();
        }
        events.append(TransactionEvent.started(command, clock.instant()));
        return command.transactionId();
    }
}
