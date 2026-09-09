package dev.desafio.transaction.inventory.application.axon;

import dev.desafio.transaction.inventory.domain.InventoryEventPublisher;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.axonframework.eventsourcing.annotation.EventSourcingHandler;
import org.axonframework.eventsourcing.annotation.reflection.EntityCreator;
import org.axonframework.extension.spring.stereotype.EventSourced;

import java.time.Instant;
import java.util.List;
import dev.desafio.transaction.inventory.domain.StockItem;

@EventSourced(tagKey = InventoryReservation.TAG_KEY, idType = String.class)
public final class InventoryEventSourcedEntity {
    private InventoryReservation reservation;

    @EntityCreator
    public InventoryEventSourcedEntity(InventoryReservedAxonEvent event) {
        reservation = new InventoryReservation(event.payload());
    }

    @EntityCreator
    public InventoryEventSourcedEntity(InventoryReservationRejectedAxonEvent event) {
        reservation = new InventoryReservation(event.payload());
    }

    public boolean commit(String correlationId, String causationId, Instant occurredAt,
                          InventoryEventPublisher events) {
        return reservation.commit(correlationId, causationId, occurredAt, events);
    }

    public boolean release(String correlationId, String causationId, Instant occurredAt,
                           InventoryEventPublisher events) {
        return reservation.release(correlationId, causationId, occurredAt, events);
    }

    public InventoryReservation.Status status() {
        return reservation.status();
    }

    public boolean isSameRequest(String orderId, List<StockItem> items) {
        return reservation.isSameRequest(orderId, items);
    }

    @EventSourcingHandler
    public void on(InventoryCommittedAxonEvent event) {
        reservation.on(event.payload());
    }

    @EventSourcingHandler
    public void on(InventoryReleasedAxonEvent event) {
        reservation.on(event.payload());
    }
}
