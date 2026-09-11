package dev.desafio.transaction.transaction.adapter.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CheckoutOperationJpaRepository extends JpaRepository<CheckoutOperationEntity, String> {
    Optional<CheckoutOperationEntity> findBySubjectAndOperationKey(String subject, String operationKey);

    Optional<CheckoutOperationEntity> findByOperationId(String operationId);

    @Modifying
    @Query("update CheckoutOperationEntity e set e.status = dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository$Status.WOO_CREATION_REQUESTED, e.updatedAt = :now where e.operationId = :id and e.status = dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository$Status.PENDING_WOO")
    int markWooCreationRequested(@Param("id") String id, @Param("now") java.time.Instant now);

    @Modifying
    @Query(value = """
        update transaction.checkout_operation
           set woo_order_id = :wooOrderId, items = cast(:items as jsonb), amount = :amount,
               currency = :currency, status = 'WOO_CONFIRMED', updated_at = :now
         where operation_id = :id and status = 'WOO_CREATION_REQUESTED'
        """, nativeQuery = true)
    int recordWooOrder(@Param("id") String id, @Param("wooOrderId") String wooOrderId,
                       @Param("items") String items, @Param("amount") java.math.BigDecimal amount,
                       @Param("currency") String currency, @Param("now") java.time.Instant now);

    @Modifying
    @Query(value = "update transaction.checkout_operation set status = 'COMPLETED', updated_at = :now where operation_id = :id and status = 'WOO_CONFIRMED'", nativeQuery = true)
    int complete(@Param("id") String id, @Param("now") java.time.Instant now);

    @Modifying
    @Query(value = "update transaction.checkout_operation set status = 'FAILED', error_reason = :reason, updated_at = :now where operation_id = :id and status in ('PENDING_WOO', 'WOO_CREATION_REQUESTED')", nativeQuery = true)
    int fail(@Param("id") String id, @Param("reason") String reason, @Param("now") java.time.Instant now);

    Optional<CheckoutOperationEntity> findByWooReference(String wooReference);

    Optional<CheckoutOperationEntity> findByOperationIdAndSubject(String operationId, String subject);
}
