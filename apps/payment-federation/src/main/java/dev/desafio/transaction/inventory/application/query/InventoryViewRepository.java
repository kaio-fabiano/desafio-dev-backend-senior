package dev.desafio.transaction.inventory.application.query;

import java.util.Optional;

public interface InventoryViewRepository {
    Optional<InventoryReservationView> findByTransactionId(String transactionId);
}
