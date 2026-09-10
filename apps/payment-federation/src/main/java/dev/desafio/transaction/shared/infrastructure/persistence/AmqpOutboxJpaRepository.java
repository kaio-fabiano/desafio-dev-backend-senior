package dev.desafio.transaction.shared.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@NoRepositoryBean
public interface AmqpOutboxJpaRepository<T extends AmqpOutboxEntity>
    extends JpaRepository<T, UUID> {

    Optional<T> findBySourceEventId(String sourceEventId);

    int countByPublishedAtIsNull();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("""
        select record from #{#entityName} record
        where record.publishedAt is null
          and (record.claimUntil is null or record.claimUntil < :now)
        order by record.occurredAt, record.eventId
        """)
    List<T> lockPending(@Param("now") Instant now, Pageable page);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select record from #{#entityName} record where record.eventId = :eventId")
    Optional<T> lockByEventId(@Param("eventId") UUID eventId);
}
