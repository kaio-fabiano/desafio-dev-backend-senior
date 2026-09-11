package dev.desafio.transaction.inventory.application.command;

import dev.desafio.transaction.inventory.application.event.InventoryAxonEvents;
import dev.desafio.transaction.inventory.application.axon.InventoryEventSourcedEntity;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.axonframework.modelling.annotation.InjectEntity;

import java.time.Clock;

public final class ReleaseInventoryCommandHandler {
    private final Clock clock;

    public ReleaseInventoryCommandHandler(Clock clock) {
        this.clock = clock;
    }

    @CommandHandler
    public InventoryReservation.Status handle(
        ReleaseInventoryCommand command,
        @InjectEntity InventoryEventSourcedEntity reservation,
        org.axonframework.messaging.eventhandling.gateway.EventAppender appender
    ) {
        reservation.release(command.correlationId(), command.causationId(), clock.instant(),
            event -> appender.append(InventoryAxonEvents.wrap(event)));
        return reservation.status();
    }
}
