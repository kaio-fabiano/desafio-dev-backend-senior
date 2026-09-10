package dev.desafio.transaction.inventory.adapter.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface InventoryInboxJpaRepository extends JpaRepository<InventoryInboxEntity, UUID> {}
