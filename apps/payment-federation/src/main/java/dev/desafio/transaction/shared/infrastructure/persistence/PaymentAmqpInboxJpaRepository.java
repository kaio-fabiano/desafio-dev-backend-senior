package dev.desafio.transaction.shared.infrastructure.persistence;

public interface PaymentAmqpInboxJpaRepository
    extends AmqpInboxJpaRepository<PaymentAmqpInboxEntity> {}
