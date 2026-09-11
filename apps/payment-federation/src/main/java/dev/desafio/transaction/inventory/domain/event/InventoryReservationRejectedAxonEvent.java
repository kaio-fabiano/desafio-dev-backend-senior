package dev.desafio.transaction.inventory.domain.event;

import dev.desafio.transaction.inventory.domain.event.InventoryReservationRejectedEvent;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

@Event(namespace = "inventory", name = "InventoryReservationRejected", version = "1.0.0")
public record InventoryReservationRejectedAxonEvent(
    @EventTag String inventoryReservationId,
    InventoryReservationRejectedEvent payload
) {}
