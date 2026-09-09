package dev.desafio.transaction.inventory.application.command;

import dev.desafio.transaction.inventory.application.axon.InventoryAxonEvents;
import dev.desafio.transaction.inventory.application.axon.InventoryEventSourcedEntity;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.axonframework.modelling.annotation.InjectEntity;

import java.time.Clock;

public final class CommitInventoryCommandHandler {
    private final Clock clock;

    public CommitInventoryCommandHandler(Clock clock) {
        this.clock = clock;
    }

    @CommandHandler
    public InventoryReservation.Status handle(
        CommitInventoryCommand command,
        @InjectEntity InventoryEventSourcedEntity reservation,
        org.axonframework.messaging.eventhandling.gateway.EventAppender appender
    ) {
        reservation.commit(command.correlationId(), command.causationId(), clock.instant(),
            event -> appender.append(InventoryAxonEvents.wrap(event)));
        return reservation.status();
    }
}
