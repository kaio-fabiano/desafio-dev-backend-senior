package dev.desafio.transaction.inventory.adapter.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository("inventoryIntegrationOutboxJpaRepository")
public interface InventoryAmqpOutboxJpaRepository
    extends JpaRepository<InventoryAmqpOutboxEntity, UUID> {
    Optional<InventoryAmqpOutboxEntity> findBySourceEventId(String sourceEventId);
}
