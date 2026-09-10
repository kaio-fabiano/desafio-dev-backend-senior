package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;

import java.util.UUID;

public interface InboxStore {
    boolean processOnce(
        String consumer,
        IntegrationEventEnvelope<JsonNode> event,
        Handler handler
    );

    String disposition(String consumer, UUID eventId);

    enum Disposition {
        PROCESSING,
        COMPLETED,
        BUSINESS_REJECTED
    }

    @FunctionalInterface
    interface Handler {
        Disposition handle(IntegrationEventEnvelope<JsonNode> event);
    }
}
