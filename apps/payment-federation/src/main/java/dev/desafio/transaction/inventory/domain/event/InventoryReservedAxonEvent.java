package dev.desafio.transaction.inventory.domain.event;

import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

@Event(namespace = "inventory", name = "InventoryReserved", version = "1.0.0")
public record InventoryReservedAxonEvent(
    @EventTag String inventoryReservationId,
    InventoryReservedEvent payload
) {}
