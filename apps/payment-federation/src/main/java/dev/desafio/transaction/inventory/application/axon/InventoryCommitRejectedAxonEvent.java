package dev.desafio.transaction.inventory.application.axon;

import dev.desafio.transaction.inventory.domain.event.InventoryCommitRejectedEvent;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

@Event(namespace = "inventory", name = "InventoryCommitRejected", version = "1.0.0")
public record InventoryCommitRejectedAxonEvent(
    @EventTag String inventoryReservationId,
    InventoryCommitRejectedEvent payload
) {}
