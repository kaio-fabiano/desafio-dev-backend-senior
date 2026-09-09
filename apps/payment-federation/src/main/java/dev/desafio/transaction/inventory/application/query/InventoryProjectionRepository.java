package dev.desafio.transaction.inventory.application.query;

import java.util.Optional;

public interface InventoryProjectionRepository {
    void save(InventoryReservationView view);
    Optional<InventoryReservationView> find(String inventoryReservationId);
}
