package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.util.Objects;
import java.util.UUID;

public final class JpaInboxStore<T extends AmqpInboxEntity> implements InboxStore {
    private final AmqpInboxJpaRepository<T> records;
    private final EntityManager entityManager;
    private final ObjectMapper json;
    private final Clock clock;
    private final InboxEntityFactory<T> entityFactory;
    private final TransactionTemplate transactions;

    private JpaInboxStore(
        AmqpInboxJpaRepository<T> records,
        EntityManager entityManager,
        ObjectMapper json,
        Clock clock,
        InboxEntityFactory<T> entityFactory,
        PlatformTransactionManager transactionManager
    ) {
        this.records = Objects.requireNonNull(records, "records");
        this.entityManager = Objects.requireNonNull(entityManager, "entityManager");
        this.json = Objects.requireNonNull(json, "json");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.entityFactory = Objects.requireNonNull(entityFactory, "entityFactory");
        transactions = new TransactionTemplate(
            Objects.requireNonNull(transactionManager, "transactionManager")
        );
        transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public static JpaInboxStore<TransactionAmqpInboxEntity> transaction(
        TransactionAmqpInboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        Clock clock,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaInboxStore<>(
            records, entityManager, json, clock, TransactionAmqpInboxEntity::new,
            transactionManager
        );
    }

    public static JpaInboxStore<InventoryAmqpInboxEntity> inventory(
        InventoryAmqpInboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        Clock clock,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaInboxStore<>(
            records, entityManager, json, clock, InventoryAmqpInboxEntity::new,
            transactionManager
        );
    }

    public static JpaInboxStore<PaymentAmqpInboxEntity> payment(
        PaymentAmqpInboxJpaRepository records,
        EntityManager entityManager,
        ObjectMapper json,
        Clock clock,
        PlatformTransactionManager transactionManager
    ) {
        return new JpaInboxStore<>(
            records, entityManager, json, clock, PaymentAmqpInboxEntity::new,
            transactionManager
        );
    }

    @Override
    public boolean processOnce(
        String consumer,
        IntegrationEventEnvelope<JsonNode> event,
        Handler handler
    ) {
        Objects.requireNonNull(event, "event");
        Objects.requireNonNull(handler, "handler");
        var id = new AmqpInboxId(consumer, event.eventId());
        var envelope = json.valueToTree(event);
        ensureRecord(id, event, envelope);

        return Boolean.TRUE.equals(transactions.execute(ignored -> records.lockById(id)
            .map(record -> processLocked(record, envelope, event, handler))
            .orElse(false)));
    }

    @Override
    public String disposition(String consumer, UUID eventId) {
        return records.findById(new AmqpInboxId(consumer, eventId))
            .orElseThrow(() -> new IllegalArgumentException("inbox record does not exist"))
            .dispositionName();
    }

    private void ensureRecord(
        AmqpInboxId id,
        IntegrationEventEnvelope<JsonNode> event,
        JsonNode envelope
    ) {
        try {
            transactions.executeWithoutResult(ignored -> {
                var existing = records.findById(id);
                if (existing.isPresent()) {
                    requireSameEnvelope(existing.orElseThrow(), envelope);
                    return;
                }
                var record = entityFactory.create(
                    id,
                    event.eventType(),
                    event.correlationId(),
                    event.causationId(),
                    envelope
                );
                entityManager.persist(record);
                entityManager.flush();
            });
        } catch (DataIntegrityViolationException | PersistenceException collision) {
            transactions.executeWithoutResult(ignored -> requireSameEnvelope(
                records.findById(id).orElseThrow(() -> collision), envelope
            ));
        }
    }

    private boolean processLocked(
        T record,
        JsonNode envelope,
        IntegrationEventEnvelope<JsonNode> event,
        Handler handler
    ) {
        requireSameEnvelope(record, envelope);
        if (!record.isProcessing()) return false;
        record.complete(handler.handle(event), clock.instant());
        return true;
    }

    private static void requireSameEnvelope(AmqpInboxEntity record, JsonNode envelope) {
        if (!record.hasSameEnvelope(envelope)) {
            throw new IllegalArgumentException("eventId identifies a different envelope");
        }
    }

    @FunctionalInterface
    private interface InboxEntityFactory<T extends AmqpInboxEntity> {
        T create(
            AmqpInboxId id,
            String eventType,
            String correlationId,
            String causationId,
            JsonNode envelope
        );
    }
}
