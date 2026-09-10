package dev.desafio.transaction.transaction.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface TransactionViewJpaRepository extends JpaRepository<TransactionViewEntity, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TransactionViewEntity> findByTransactionId(String transactionId);

    Optional<TransactionViewEntity> findByTransactionIdAndOwnerSubject(String transactionId, String ownerSubject);

    Optional<TransactionViewEntity> findByWooOrderIdAndOwnerSubject(String wooOrderId, String ownerSubject);
}
