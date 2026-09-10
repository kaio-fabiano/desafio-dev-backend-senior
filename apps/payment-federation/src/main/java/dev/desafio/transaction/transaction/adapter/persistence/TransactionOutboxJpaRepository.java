package dev.desafio.transaction.transaction.adapter.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TransactionOutboxJpaRepository extends JpaRepository<TransactionOutboxEntity, UUID> {
    Optional<TransactionOutboxEntity> findBySourceEventId(String sourceEventId);
}
