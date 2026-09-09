package dev.desafio.transaction.inventory.application.axon;

import dev.desafio.transaction.inventory.domain.event.InventoryCommittedEvent;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

@Event(namespace = "inventory", name = "InventoryCommitted", version = "1.0.0")
public record InventoryCommittedAxonEvent(
    @EventTag String inventoryReservationId,
    InventoryCommittedEvent payload
) {}
