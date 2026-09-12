package dev.desafio.transaction.inventory.application.command;

import dev.desafio.transaction.inventory.application.event.InventoryAxonEvents;
import dev.desafio.transaction.inventory.application.axon.InventoryEventSourcedEntity;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import dev.desafio.transaction.inventory.domain.StockItem;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.axonframework.modelling.annotation.InjectEntity;

import java.time.Clock;
import java.util.List;

public final class CommitInventoryCommandHandler {
    private final Clock clock;
    private final CommitDecision commit;

    public CommitInventoryCommandHandler(Clock clock) {
        this(clock, (ignoredId, ignoredItems) -> true);
    }

    public CommitInventoryCommandHandler(Clock clock, CommitDecision commit) {
        this.clock = clock;
        this.commit = commit;
    }

    @CommandHandler
    public InventoryReservation.Status handle(
        CommitInventoryCommand command,
        @InjectEntity InventoryEventSourcedEntity reservation,
        org.axonframework.messaging.eventhandling.gateway.EventAppender appender
    ) {
        if (commit.accepted(command.inventoryReservationId(), reservation.items())) {
            reservation.commit(command.correlationId(), command.causationId(), clock.instant(),
                event -> appender.append(InventoryAxonEvents.wrap(event)));
        } else {
            reservation.rejectCommit(
                "STOCK_COMMIT_REJECTED", command.correlationId(), command.causationId(),
                clock.instant(), event -> appender.append(InventoryAxonEvents.wrap(event))
            );
        }
        return reservation.status();
    }

    @FunctionalInterface
    public interface CommitDecision {
        boolean accepted(String inventoryReservationId, List<StockItem> items);
    }
}
