package dev.desafio.transaction.payment.adapter.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SpringDataPaymentOutboxRepository
    extends JpaRepository<PaymentOutboxEntity, UUID> {

    Optional<PaymentOutboxEntity> findByEffectId(UUID effectId);
}
