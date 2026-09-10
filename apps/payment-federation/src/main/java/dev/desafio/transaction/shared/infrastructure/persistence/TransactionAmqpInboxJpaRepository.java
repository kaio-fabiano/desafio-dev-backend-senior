package dev.desafio.transaction.shared.infrastructure.persistence;

public interface TransactionAmqpInboxJpaRepository
    extends AmqpInboxJpaRepository<TransactionAmqpInboxEntity> {}
