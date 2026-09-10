package dev.desafio.transaction.payment.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SpringDataPaymentRecordRepository
    extends JpaRepository<PaymentRecordEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payment from PaymentRecordEntity payment "
        + "where payment.paymentId = :paymentId or payment.operationKey = :operationKey")
    List<PaymentRecordEntity> lockByPaymentIdOrOperationKey(
        @Param("paymentId") String paymentId,
        @Param("operationKey") String operationKey
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payment from PaymentRecordEntity payment "
        + "where payment.providerReference = :providerReference")
    Optional<PaymentRecordEntity> lockByProviderReference(
        @Param("providerReference") String providerReference
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payment from PaymentRecordEntity payment where payment.paymentId = :paymentId")
    Optional<PaymentRecordEntity> lockByPaymentId(@Param("paymentId") String paymentId);

    Optional<PaymentRecordEntity> findByTransactionId(String transactionId);
}
