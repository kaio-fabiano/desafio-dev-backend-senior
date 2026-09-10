package dev.desafio.transaction.shared.infrastructure.persistence;

final class PersistenceErrorMessages {
    static final String UNKNOWN_CONTEXT_SCHEMA = "unknown context schema";
    static final String INBOX_EVENT_CONFLICT = "eventId identifies a different envelope";
    static final String OUTBOX_EVENT_CONFLICT = "sourceEventId identifies a different envelope";
    static final String INBOX_COMPLETION_LOST = "inbox completion was not persisted";
    static final String OUTBOX_CLAIM_LOST = "outbox claim was lost";
    static final String SERIALIZATION_FAILED = "integration event cannot be serialized";

    private PersistenceErrorMessages() {}
}
