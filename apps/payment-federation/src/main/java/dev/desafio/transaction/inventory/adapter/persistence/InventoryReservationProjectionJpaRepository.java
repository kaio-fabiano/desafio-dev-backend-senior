package dev.desafio.transaction.inventory.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface InventoryReservationProjectionJpaRepository
    extends JpaRepository<InventoryReservationProjectionEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select projection from InventoryReservationProjectionEntity projection"
        + " where projection.inventoryReservationId = :id")
    Optional<InventoryReservationProjectionEntity> lockById(String id);

    Optional<InventoryReservationProjectionEntity> findFirstByTransactionId(String transactionId);
}
