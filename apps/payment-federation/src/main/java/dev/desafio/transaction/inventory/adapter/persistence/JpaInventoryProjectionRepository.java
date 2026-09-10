package dev.desafio.transaction.inventory.adapter.persistence;

import dev.desafio.transaction.inventory.application.query.InventoryProjectionRepository;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;

public final class JpaInventoryProjectionRepository implements InventoryProjectionRepository {
    private final InventoryReservationProjectionJpaRepository projections;
    private final TransactionTemplate transactions;

    public JpaInventoryProjectionRepository(
        InventoryReservationProjectionJpaRepository projections,
        PlatformTransactionManager transactionManager
    ) {
        this.projections = projections;
        transactions = new TransactionTemplate(transactionManager);
    }

    @Override
    public void save(InventoryReservationView view) {
        transactions.executeWithoutResult(ignored -> {
            var stored = projections.lockById(view.inventoryReservationId());
            if (stored.isEmpty()) {
                projections.save(InventoryReservationProjectionMapper.toEntity(view));
            } else if (stored.orElseThrow().version() < view.version()) {
                stored.orElseThrow().update(
                    view.transactionId(), view.orderId(), view.status(), view.version(),
                    view.reason(), view.updatedAt()
                );
                projections.save(stored.orElseThrow());
            }
        });
    }

    @Override
    public Optional<InventoryReservationView> find(String inventoryReservationId) {
        return projections.findById(inventoryReservationId)
            .map(InventoryReservationProjectionMapper::toView);
    }
}
