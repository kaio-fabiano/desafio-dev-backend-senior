package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OutboxStore {
    void enqueue(String sourceEventId, IntegrationEventEnvelope<JsonNode> event);

    List<PendingMessage> claim(int limit, String relayId, Instant now, Duration lease);

    void markPublished(UUID eventId, String relayId, Instant publishedAt);

    void release(UUID eventId, String relayId, Exception error);

    int pendingCount();

    record PendingMessage(UUID eventId, String routingKey, String envelope) {}
}
