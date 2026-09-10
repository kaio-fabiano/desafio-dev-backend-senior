package dev.desafio.transaction.shared.infrastructure.persistence;

public interface TransactionAmqpOutboxJpaRepository
    extends AmqpOutboxJpaRepository<TransactionAmqpOutboxEntity> {}
