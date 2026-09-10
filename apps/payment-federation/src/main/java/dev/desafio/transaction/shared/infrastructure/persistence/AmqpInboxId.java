package dev.desafio.transaction.shared.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class AmqpInboxId implements Serializable {
    @Column(name = "consumer_name", nullable = false)
    private String consumer;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    protected AmqpInboxId() {}

    public AmqpInboxId(String consumer, UUID eventId) {
        this.consumer = required(consumer, "consumer");
        this.eventId = Objects.requireNonNull(eventId, "eventId");
    }

    String consumer() { return consumer; }

    UUID eventId() { return eventId; }

    @Override
    public boolean equals(Object other) {
        return this == other || other instanceof AmqpInboxId id
            && consumer.equals(id.consumer) && eventId.equals(id.eventId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(consumer, eventId);
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
