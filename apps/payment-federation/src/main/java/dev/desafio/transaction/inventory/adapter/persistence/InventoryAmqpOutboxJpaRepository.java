package dev.desafio.transaction.inventory.adapter.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InventoryAmqpOutboxJpaRepository
    extends JpaRepository<InventoryAmqpOutboxEntity, UUID> {
    Optional<InventoryAmqpOutboxEntity> findBySourceEventId(String sourceEventId);
}
