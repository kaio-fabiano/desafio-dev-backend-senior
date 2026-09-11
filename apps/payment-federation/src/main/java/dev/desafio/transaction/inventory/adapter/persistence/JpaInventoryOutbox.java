package dev.desafio.transaction.inventory.adapter.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.inventory.application.event.InventoryIntegrationMessage;
import dev.desafio.transaction.inventory.application.event.InventoryOutbox;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

public final class JpaInventoryOutbox implements InventoryOutbox {
    private final InventoryAmqpOutboxJpaRepository outbox;
    private final ObjectMapper json;
    private final TransactionTemplate transactions;

    public JpaInventoryOutbox(
        InventoryAmqpOutboxJpaRepository outbox,
        ObjectMapper json,
        PlatformTransactionManager transactionManager
    ) {
        this.outbox = outbox;
        this.json = json;
        transactions = new TransactionTemplate(transactionManager);
        transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public void enqueue(String sourceEventId, InventoryIntegrationMessage event) {
        var envelope = new IntegrationEventEnvelope<>(
            UUID.nameUUIDFromBytes(sourceEventId.getBytes(StandardCharsets.UTF_8)),
            event.eventType(), 1, event.aggregateId(), event.transactionId(),
            event.correlationId(), event.causationId(), event.occurredAt(),
            json.valueToTree(event.payload())
        );
        JsonNode serialized = json.valueToTree(envelope);
        try {
            transactions.executeWithoutResult(ignored -> {
                var existing = outbox.findBySourceEventId(sourceEventId);
                if (existing.isPresent()) {
                    requireSameEnvelope(sourceEventId, serialized, existing.orElseThrow());
                    return;
                }
                outbox.saveAndFlush(new InventoryAmqpOutboxEntity(
                    envelope.eventId(), sourceEventId, event.eventType(), serialized, event.occurredAt()
                ));
            });
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            transactions.executeWithoutResult(ignored -> requireSameEnvelope(
                sourceEventId,
                serialized,
                outbox.findBySourceEventId(sourceEventId).orElseThrow(() -> concurrentDuplicate)
            ));
        }
    }

    private static void requireSameEnvelope(
        String sourceEventId,
        JsonNode envelope,
        InventoryAmqpOutboxEntity existing
    ) {
        if (!existing.envelope().equals(envelope)) {
            throw new IllegalArgumentException(
                "sourceEventId identifies a different envelope: " + sourceEventId
            );
        }
    }
}
