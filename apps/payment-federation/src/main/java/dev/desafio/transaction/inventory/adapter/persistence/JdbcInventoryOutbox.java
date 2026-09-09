package dev.desafio.transaction.inventory.adapter.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.inventory.application.event.InventoryIntegrationEvent;
import dev.desafio.transaction.inventory.application.event.InventoryOutbox;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcOutboxStore;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public final class JdbcInventoryOutbox implements InventoryOutbox {
    private final JdbcOutboxStore outbox;
    private final ObjectMapper json;

    public JdbcInventoryOutbox(DataSource dataSource, ObjectMapper json) {
        outbox = new JdbcOutboxStore(dataSource, json, "inventory");
        this.json = json;
    }

    @Override
    public void enqueue(String sourceEventId, InventoryIntegrationEvent event) {
        outbox.enqueue(sourceEventId, new IntegrationEventEnvelope<>(
            UUID.nameUUIDFromBytes(sourceEventId.getBytes(StandardCharsets.UTF_8)),
            event.eventType(), 1, event.aggregateId(), event.transactionId(),
            event.correlationId(), event.causationId(), event.occurredAt(),
            json.valueToTree(event.payload())
        ));
    }
}
