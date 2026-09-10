package dev.desafio.transaction.shared.infrastructure.persistence;

public interface InventoryAmqpOutboxJpaRepository
    extends AmqpOutboxJpaRepository<InventoryAmqpOutboxEntity> {}
