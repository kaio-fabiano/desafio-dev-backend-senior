package dev.desafio.transaction.inventory.adapter.persistence;

import dev.desafio.transaction.inventory.application.query.InventoryReservationView;

final class InventoryReservationProjectionMapper {
    private InventoryReservationProjectionMapper() {}

    static InventoryReservationProjectionEntity toEntity(InventoryReservationView view) {
        return new InventoryReservationProjectionEntity(
            view.inventoryReservationId(), view.transactionId(), view.orderId(), view.status(),
            view.version(), view.reason(), view.updatedAt()
        );
    }

    static InventoryReservationView toView(InventoryReservationProjectionEntity entity) {
        return new InventoryReservationView(
            entity.inventoryReservationId(), entity.transactionId(), entity.orderId(), entity.status(),
            entity.version(), entity.reason(), entity.updatedAt()
        );
    }
}
