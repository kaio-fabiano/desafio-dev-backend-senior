package dev.desafio.transaction.inventory.application.axon;

import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;
import dev.desafio.transaction.inventory.domain.event.InventoryCommittedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryCommitRejectedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReleasedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservationRejectedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;

public final class InventoryAxonEvents {
    private InventoryAxonEvents() {}

    public static Object wrap(Object event) {
        return switch (event) {
            case InventoryReservedEvent reserved ->
                new InventoryReservedAxonEvent(reserved.inventoryReservationId(), reserved);
            case InventoryReservationRejectedEvent rejected ->
                new InventoryReservationRejectedAxonEvent(rejected.inventoryReservationId(), rejected);
            case InventoryCommittedEvent committed ->
                new InventoryCommittedAxonEvent(committed.inventoryReservationId(), committed);
            case InventoryCommitRejectedEvent rejected ->
                new InventoryCommitRejectedAxonEvent(rejected.inventoryReservationId(), rejected);
            case InventoryReleasedEvent released ->
                new InventoryReleasedAxonEvent(released.inventoryReservationId(), released);
            default -> throw new IllegalArgumentException(InventoryErrorMessages.UNSUPPORTED_DOMAIN_EVENT);
        };
    }
}
