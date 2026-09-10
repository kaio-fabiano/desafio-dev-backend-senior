package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "amqp_inbox", schema = "transaction")
public class TransactionAmqpInboxEntity extends AmqpInboxEntity {
    protected TransactionAmqpInboxEntity() {}

    TransactionAmqpInboxEntity(
        AmqpInboxId id,
        String eventType,
        String correlationId,
        String causationId,
        JsonNode envelope
    ) {
        super(id.consumer(), id.eventId(), eventType, correlationId, causationId, envelope);
    }
}
