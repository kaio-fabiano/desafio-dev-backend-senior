package dev.desafio.transaction.inventory.adapter.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InventoryResultEventJpaRepository
    extends JpaRepository<InventoryResultEventEntity, UUID> {
    Optional<InventoryResultEventEntity> findByOperationKey(String operationKey);
}
