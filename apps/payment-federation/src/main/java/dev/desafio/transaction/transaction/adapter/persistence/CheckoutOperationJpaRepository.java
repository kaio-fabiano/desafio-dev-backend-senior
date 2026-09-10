package dev.desafio.transaction.transaction.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface CheckoutOperationJpaRepository extends JpaRepository<CheckoutOperationEntity, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<CheckoutOperationEntity> findByOperationKey(String operationKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<CheckoutOperationEntity> findByTransactionId(String transactionId);

    Optional<CheckoutOperationEntity> findByWooReference(String wooReference);

    Optional<CheckoutOperationEntity> findByTransactionIdAndSubject(String transactionId, String subject);
}
