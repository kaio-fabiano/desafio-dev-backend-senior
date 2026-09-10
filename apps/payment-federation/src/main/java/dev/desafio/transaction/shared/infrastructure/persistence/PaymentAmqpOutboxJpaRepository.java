package dev.desafio.transaction.shared.infrastructure.persistence;

public interface PaymentAmqpOutboxJpaRepository
    extends AmqpOutboxJpaRepository<PaymentAmqpOutboxEntity> {}
