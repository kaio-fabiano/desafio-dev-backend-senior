package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public final class JpaOutboxStore<T extends AmqpOutboxEntity> implements OutboxStore {
    private final AmqpOutboxJpaRepository<T> records;
    private final EntityManager entityManager;
    private final ObjectMapper json;
    private final OutboxEntityFactory<T> entityFactory;
    private final TransactionTemplate transactions;

    private JpaOutboxStore(
        AmqpOutboxJpaRepository<T> records,
        EntityManager entityManager,
        ObjectMapper json,
        OutboxEntityFactory<T> entityFactory,
        PlatformTransactionManager transactionManager
    ) {
        this.records = Objects.requireNonNull(records, "records");
        this.entityManager = Objects.requireNonNull(entityManager, "entityManager");
        this.json = Objects.requireNonNull(json, "json");
        this.entityFactory = Objects.requireNonNull(entityFactory, "entityFactory");
        transactions = new TransactionTemplate(
            Objects.requireNonNull(transactionManager, "transactionManager")
        );
        transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public static JpaOutboxStore<TransactionAmqpOutboxEntity> transaction(
        TransactionAmqpOutboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaOutboxStore<>(
            records, entityManager, json, TransactionAmqpOutboxEntity::new, transactionManager
        );
    }

    public static JpaOutboxStore<InventoryAmqpOutboxEntity> inventory(
        InventoryAmqpOutboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaOutboxStore<>(
            records, entityManager, json, InventoryAmqpOutboxEntity::new, transactionManager
        );
    }

    public static JpaOutboxStore<PaymentAmqpOutboxEntity> payment(
        PaymentAmqpOutboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaOutboxStore<>(
            records, entityManager, json, PaymentAmqpOutboxEntity::new, transactionManager
        );
    }

    @Override
    public void enqueue(String sourceEventId, IntegrationEventEnvelope<JsonNode> event) {
        Objects.requireNonNull(event, "event");
        var envelope = json.valueToTree(event);
        try {
            transactions.executeWithoutResult(ignored -> {
                var existing = records.findBySourceEventId(sourceEventId);
                if (existing.isPresent()) {
                    requireSameEnvelope(existing.orElseThrow(), envelope);
                    return;
                }
                entityManager.persist(entityFactory.create(
                    event.eventId(), sourceEventId, event.eventType(), envelope, event.occurredAt()
                ));
                entityManager.flush();
            });
        } catch (DataIntegrityViolationException | PersistenceException collision) {
            transactions.executeWithoutResult(ignored -> requireSameEnvelope(
                records.findBySourceEventId(sourceEventId).orElseThrow(() -> collision), envelope
            ));
        }
    }

    @Override
    public List<PendingMessage> claim(int limit, String relayId, Instant now, Duration lease) {
        if (limit < 1) throw new IllegalArgumentException("limit must be positive");
        Objects.requireNonNull(now, "now");
        Objects.requireNonNull(lease, "lease");
        if (lease.isNegative() || lease.isZero()) {
            throw new IllegalArgumentException("lease must be positive");
        }
        return transactions.execute(ignored -> records.lockPending(now, PageRequest.of(0, limit))
            .stream()
            .map(record -> claimed(record, relayId, now.plus(lease)))
            .toList());
    }

    @Override
    public void markPublished(UUID eventId, String relayId, Instant publishedAt) {
        transactions.executeWithoutResult(ignored -> {
            var record = records.lockByEventId(eventId)
                .orElseThrow(() -> new IllegalStateException("outbox claim was lost"));
            if (!record.markPublished(relayId, publishedAt)) {
                throw new IllegalStateException("outbox claim was lost");
            }
        });
    }

    @Override
    public void release(UUID eventId, String relayId, Exception error) {
        transactions.executeWithoutResult(ignored -> records.lockByEventId(eventId)
            .ifPresent(record -> record.release(relayId, error)));
    }

    @Override
    public int pendingCount() {
        return records.countByPublishedAtIsNull();
    }

    private PendingMessage claimed(T record, String relayId, Instant claimUntil) {
        record.claim(relayId, claimUntil);
        return new PendingMessage(record.eventId(), record.routingKey(), serialize(record.envelope()));
    }

    private String serialize(JsonNode envelope) {
        try {
            return json.writeValueAsString(envelope);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("integration event cannot be serialized", error);
        }
    }

    private static void requireSameEnvelope(AmqpOutboxEntity record, JsonNode envelope) {
        if (!record.hasSameEnvelope(envelope)) {
            throw new IllegalArgumentException("sourceEventId identifies a different envelope");
        }
    }

    @FunctionalInterface
    private interface OutboxEntityFactory<T extends AmqpOutboxEntity> {
        T create(
            UUID eventId,
            String sourceEventId,
            String routingKey,
            JsonNode envelope,
            Instant occurredAt
        );
    }
}
