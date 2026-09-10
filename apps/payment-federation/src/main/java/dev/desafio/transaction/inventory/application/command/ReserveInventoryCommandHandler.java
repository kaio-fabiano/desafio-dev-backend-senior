package dev.desafio.transaction.inventory.application.command;

import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.application.axon.InventoryAxonEvents;
import dev.desafio.transaction.inventory.application.axon.InventoryEventSourcedEntity;
import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.axonframework.modelling.annotation.InjectEntity;

import java.time.Clock;
import java.util.Optional;

public final class ReserveInventoryCommandHandler {
    private final InventoryService inventory;
    private final Clock clock;

    public ReserveInventoryCommandHandler(InventoryService inventory, Clock clock) {
        this.inventory = inventory;
        this.clock = clock;
    }

    @CommandHandler
    public InventoryReservation.Status handle(
        ReserveInventoryCommand command,
        @InjectEntity Optional<InventoryEventSourcedEntity> existing,
        org.axonframework.messaging.eventhandling.gateway.EventAppender appender
    ) {
        if (existing.isPresent()) {
            var reservation = existing.orElseThrow();
            if (!reservation.isSameRequest(command.orderId(), command.items())) {
                throw new IllegalArgumentException(
                    InventoryErrorMessages.TRANSACTION_ID_IDENTIFIES_DIFFERENT_RESERVATION
                );
            }
            return reservation.status();
        }
        var request = new Inventory.ReservationRequested(
            command.incomingEventId(), command.operationKey(), command.orderId(),
            command.items().stream()
                .map(item -> new Inventory.StockItem(item.productId(), item.quantity()))
                .toList()
        );
        var result = inventory.handle(request);
        var available = "stock.reserved".equals(result.event().eventType());
        if (!available) {
            return InventoryReservation.decide(
                command.inventoryReservationId(), command.transactionId(), command.orderId(),
                command.items(), false, command.correlationId(), command.causationId(),
                clock.instant(), event -> appender.append(InventoryAxonEvents.wrap(event))
            ).status();
        }
        var event = new dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent(
            command.inventoryReservationId(), command.transactionId(), command.orderId(), command.items(),
            command.paymentId(), command.paymentOperationKey(), command.paymentMethod(), command.amount(),
            command.currency(), command.payerEmail(), 1, command.correlationId(), command.causationId(),
            clock.instant()
        );
        appender.append(new dev.desafio.transaction.inventory.application.axon.InventoryReservedAxonEvent(
            command.inventoryReservationId(), event
        ));
        return InventoryReservation.Status.RESERVED;
    }
}
