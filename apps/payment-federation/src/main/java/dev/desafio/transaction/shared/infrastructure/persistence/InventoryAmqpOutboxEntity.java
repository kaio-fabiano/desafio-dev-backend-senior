package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "amqp_outbox", schema = "inventory")
public class InventoryAmqpOutboxEntity extends AmqpOutboxEntity {
    protected InventoryAmqpOutboxEntity() {}

    InventoryAmqpOutboxEntity(
        UUID eventId,
        String sourceEventId,
        String routingKey,
        JsonNode envelope,
        Instant occurredAt
    ) {
        super(eventId, sourceEventId, routingKey, envelope, occurredAt);
    }
}
