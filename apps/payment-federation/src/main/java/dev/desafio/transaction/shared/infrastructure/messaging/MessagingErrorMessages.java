package dev.desafio.transaction.shared.infrastructure.messaging;

final class MessagingErrorMessages {
    static final String SERIALIZATION_FAILED = "integration event cannot be serialized";
    static final String REUSABLE_CREDENTIALS =
        "reusable credentials are forbidden in integration events";
    static final String ROUTING_KEY_MISMATCH = "outbox routing key does not match event type";
    static final String PUBLICATION_FAILED = "outbox publication failed";
    private static final String UNROUTABLE_EVENT_PREFIX = "unroutable event: ";

    private MessagingErrorMessages() {}

    static String unroutableEvent(String returned) {
        return UNROUTABLE_EVENT_PREFIX + returned;
    }
}
