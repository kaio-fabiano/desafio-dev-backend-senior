package dev.desafio.transaction.migration;

final class MigrationErrorMessages {
    static final String INSPECTION_BLOCKED =
        "Legacy clean-start blocked because durable state could not be inspected";
    private static final String BLOCKED_PREFIX = "Legacy clean-start blocked: ";

    private MigrationErrorMessages() {}

    static String blocked(LegacyCleanStartGate.Audit audit) {
        return BLOCKED_PREFIX + audit;
    }

    static String required(String property) {
        return property + " is required";
    }
}
