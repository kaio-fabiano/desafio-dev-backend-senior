package dev.desafio.transaction.inventory.adapter.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface InventoryOperationJpaRepository
    extends JpaRepository<InventoryOperationEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select operation from InventoryOperationEntity operation where operation.operationKey = :key")
    Optional<InventoryOperationEntity> lockByOperationKey(String key);
}
