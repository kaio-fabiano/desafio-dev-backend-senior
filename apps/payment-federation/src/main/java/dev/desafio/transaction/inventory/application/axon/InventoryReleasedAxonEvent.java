package dev.desafio.transaction.inventory.application.axon;

import dev.desafio.transaction.inventory.domain.event.InventoryReleasedEvent;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

@Event(namespace = "inventory", name = "InventoryReleased", version = "1.0.0")
public record InventoryReleasedAxonEvent(
    @EventTag String inventoryReservationId,
    InventoryReleasedEvent payload
) {}
