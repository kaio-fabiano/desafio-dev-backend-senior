package dev.desafio.transaction.contracts.integration.v1;

final class IntegrationEventErrorMessages {
    static final String EVENT_ID_REQUIRED = "eventId";
    static final String OCCURRED_AT_REQUIRED = "occurredAt";
    static final String PAYLOAD_REQUIRED = "payload";
    static final String EVENT_TYPE_VERSION = "eventType must end with .v1";
    static final String VERSION = "version must be 1";

    private IntegrationEventErrorMessages() {}

    static String required(String field) {
        return field + " is required";
    }
}
