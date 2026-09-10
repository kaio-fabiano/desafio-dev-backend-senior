package dev.desafio.transaction.payment.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface SpringDataPaymentEffectRepository
    extends JpaRepository<PaymentEffectEntity, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select effect from PaymentEffectEntity effect where effect.effectId = :effectId")
    Optional<PaymentEffectEntity> findLockedByEffectId(@Param("effectId") UUID effectId);
}
