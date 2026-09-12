package dev.desafio.transaction.transaction.adapter.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.transaction.application.TransactionOutbox;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Comparator;

public final class JpaTransactionOutbox implements TransactionOutbox {
    private static final Comparator<JsonNode> JSONB_EQUALITY = (left, right) -> {
        if (left.isNumber() && right.isNumber()) return left.decimalValue().compareTo(right.decimalValue());
        return left.equals(right) ? 0 : 1;
    };

    private final ObjectMapper json;
    private final TransactionOutboxJpaRepository records;
    private final EntityManager entityManager;
    private final TransactionTemplate transaction;

    public JpaTransactionOutbox(
        ObjectMapper json,
        TransactionOutboxJpaRepository records,
        EntityManager entityManager,
        PlatformTransactionManager transactionManager
    ) {
        this.json = json;
        this.records = records;
        this.entityManager = entityManager;
        transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
    }

    @Override
    public void enqueueOrderReceived(TransactionEvent event) {
        var payload = json.createObjectNode();
        payload.put("orderId", event.wooOrderId());
        payload.put("paymentMethod", event.paymentMethod());
        payload.put("amount", event.amount());
        payload.put("currency", event.currency());
        payload.put("paymentId", "payment:" + event.transactionId());
        payload.put("paymentOperationKey", event.operationKey() + ":payment");
        payload.put("payerEmail", event.payerEmail());
        if ("CARD".equals(event.paymentMethod())) {
            payload.put("providerCredentialReference", event.providerToken());
            payload.put("paymentMethodId", event.paymentMethodId());
        }
        payload.set("items", json.valueToTree(event.items()));
        var envelope = new IntegrationEventEnvelope<JsonNode>(
            event.eventId(), "transaction.order-received.v1", 1, event.transactionId(),
            event.transactionId(), event.operationKey(), event.eventId().toString(), event.occurredAt(), payload
        );
        var document = json.valueToTree(envelope);
        var entity = new TransactionOutboxEntity(
            event.eventId(), event.eventId().toString(), envelope.eventType(), document, event.occurredAt()
        );
        persist(event, document, entity);
    }

    @Override
    public void enqueueCancelled(TransactionEvent event) {
        var payload = json.createObjectNode();
        payload.put("reason", event.reference() != null ? event.reference() : event.status().name());
        var envelope = new IntegrationEventEnvelope<JsonNode>(
            event.eventId(), "transaction.cancelled.v1", 1, event.transactionId(),
            event.transactionId(), event.operationKey(), event.eventId().toString(), event.occurredAt(), payload
        );
        var document = json.valueToTree(envelope);
        var entity = new TransactionOutboxEntity(
            event.eventId(), event.eventId().toString(), envelope.eventType(), document, event.occurredAt()
        );
        persist(event, document, entity);
    }

    private void persist(TransactionEvent event, JsonNode document, TransactionOutboxEntity entity) {
        try {
            transaction.executeWithoutResult(ignored -> {
                entityManager.persist(entity);
                entityManager.flush();
            });
        } catch (DataIntegrityViolationException | PersistenceException collision) {
            var existing = records.findBySourceEventId(event.eventId().toString()).orElseThrow(() -> collision);
            if (!existing.envelope().equals(JSONB_EQUALITY, document)) {
                throw new IllegalArgumentException("sourceEventId identifies a different envelope", collision);
            }
        }
    }
}
