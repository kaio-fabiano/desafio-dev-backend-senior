package dev.desafio.transaction.inventory.adapter.persistence;

import dev.desafio.transaction.inventory.domain.Inventory;

import java.util.Map;

final class InventoryResultEventMapper {
    private InventoryResultEventMapper() {}

    static InventoryResultEventEntity toEntity(Inventory.OutgoingEvent event) {
        var payload = event.payload();
        return new InventoryResultEventEntity(
            event.eventId(), event.operationKey(), event.eventType(), event.eventVersion(),
            payload.get("orderId"), payload.get("reservationId"), payload.get("reason"),
            event.occurredAt()
        );
    }

    static Inventory.OutgoingEvent toDomain(InventoryResultEventEntity entity) {
        var payload = entity.reason() == null
            ? Map.of("orderId", entity.orderId(), "reservationId", entity.reservationId())
            : Map.of("orderId", entity.orderId(), "reason", entity.reason());
        return new Inventory.OutgoingEvent(
            entity.eventId(), entity.eventType(), entity.eventVersion(), entity.operationKey(),
            entity.occurredAt(), payload
        );
    }
}
