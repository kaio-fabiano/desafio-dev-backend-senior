package dev.desafio.transaction.inventory.adapter.persistence;

import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;

import java.util.Optional;

public final class JpaInventoryViewRepository implements InventoryViewRepository {
    private final InventoryReservationProjectionJpaRepository projections;

    public JpaInventoryViewRepository(InventoryReservationProjectionJpaRepository projections) {
        this.projections = projections;
    }

    @Override
    public Optional<InventoryReservationView> findByTransactionId(String transactionId) {
        return projections.findFirstByTransactionId(transactionId)
            .map(InventoryReservationProjectionMapper::toView);
    }
}
