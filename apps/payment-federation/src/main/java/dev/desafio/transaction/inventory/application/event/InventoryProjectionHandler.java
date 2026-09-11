package dev.desafio.transaction.inventory.application.event;

import dev.desafio.transaction.inventory.application.query.InventoryProjectionRepository;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.domain.event.InventoryCommittedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryCommitRejectedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReleasedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservationRejectedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedAxonEvent;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;

public final class InventoryProjectionHandler {
    private final InventoryProjectionRepository projections;

    public InventoryProjectionHandler(InventoryProjectionRepository projections) {
        this.projections = projections;
    }

    @EventHandler
    public void on(InventoryReservedAxonEvent message) {
        var event = message.payload();
        save(event.inventoryReservationId(), event.transactionId(), event.orderId(),
            InventoryReservation.Status.RESERVED, event.version(), null, event.occurredAt());
    }

    @EventHandler
    public void on(InventoryReservationRejectedAxonEvent message) {
        var event = message.payload();
        save(event.inventoryReservationId(), event.transactionId(), event.orderId(),
            InventoryReservation.Status.REJECTED, event.version(), event.reason(), event.occurredAt());
    }

    @EventHandler
    public void on(InventoryCommittedAxonEvent message) {
        var event = message.payload();
        save(event.inventoryReservationId(), event.transactionId(), event.orderId(),
            InventoryReservation.Status.COMMITTED, event.version(), null, event.occurredAt());
    }

    @EventHandler
    public void on(InventoryCommitRejectedAxonEvent message) {
        var event = message.payload();
        save(event.inventoryReservationId(), event.transactionId(), event.orderId(),
            InventoryReservation.Status.COMMIT_REJECTED, event.version(), event.reason(), event.occurredAt());
    }

    @EventHandler
    public void on(InventoryReleasedAxonEvent message) {
        var event = message.payload();
        save(event.inventoryReservationId(), event.transactionId(), event.orderId(),
            InventoryReservation.Status.RELEASED, event.version(), null, event.occurredAt());
    }

    private void save(String id, String transactionId, String orderId,
                      InventoryReservation.Status status, long version, String reason,
                      java.time.Instant updatedAt) {
        projections.save(new InventoryReservationView(
            id, transactionId, orderId, status, version, reason, updatedAt
        ));
    }
}
