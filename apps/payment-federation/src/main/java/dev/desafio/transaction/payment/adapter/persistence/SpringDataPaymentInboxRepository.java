package dev.desafio.transaction.payment.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface SpringDataPaymentInboxRepository
    extends JpaRepository<PaymentInboxEntity, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select inbox from PaymentInboxEntity inbox where inbox.eventId = :eventId")
    Optional<PaymentInboxEntity> findLockedByEventId(@Param("eventId") UUID eventId);
}
