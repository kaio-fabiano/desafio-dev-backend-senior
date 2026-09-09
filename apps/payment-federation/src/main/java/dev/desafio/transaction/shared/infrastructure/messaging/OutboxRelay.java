package dev.desafio.transaction.shared.infrastructure.messaging;

import dev.desafio.transaction.shared.infrastructure.persistence.JdbcOutboxStore;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;

public final class OutboxRelay {
    private static final Duration CLAIM_LEASE = Duration.ofMinutes(1);

    private final JdbcOutboxStore outbox;
    private final ConfirmedAmqpPublisher publisher;
    private final IntegrationEventJson json;
    private final Clock clock;
    private final String relayId;

    public OutboxRelay(
        JdbcOutboxStore outbox,
        ConfirmedAmqpPublisher publisher,
        IntegrationEventJson json,
        Clock clock,
        String relayId
    ) {
        this.outbox = outbox;
        this.publisher = publisher;
        this.json = json;
        this.clock = clock;
        this.relayId = relayId;
    }

    public int publishAvailable(int limit) {
        var messages = outbox.claim(limit, relayId, clock.instant(), CLAIM_LEASE);
        var published = 0;
        for (var message : messages) {
            try {
                var event = json.read(message.envelope().getBytes(StandardCharsets.UTF_8));
                if (!message.routingKey().equals(event.eventType())) {
                    throw new IllegalArgumentException("outbox routing key does not match event type");
                }
                publisher.publish(event);
                outbox.markPublished(message.eventId(), relayId, clock.instant());
                published++;
            } catch (Exception error) {
                outbox.release(message.eventId(), relayId, error);
                throw error instanceof RuntimeException runtime
                    ? runtime
                    : new IllegalStateException("outbox publication failed", error);
            }
        }
        return published;
    }
}
