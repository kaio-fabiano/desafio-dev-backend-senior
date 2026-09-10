package dev.desafio.transaction.payment.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SpringDataProviderNotificationRepository
    extends JpaRepository<ProviderNotificationEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select notification from ProviderNotificationEntity notification "
        + "where notification.providerRequestId = :providerRequestId")
    Optional<ProviderNotificationEntity> findLockedByProviderRequestId(
        @Param("providerRequestId") String providerRequestId
    );
}
