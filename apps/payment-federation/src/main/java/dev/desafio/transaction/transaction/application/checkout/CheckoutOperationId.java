package dev.desafio.transaction.transaction.application.checkout;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

public record CheckoutOperationId(String value) {
    public CheckoutOperationId {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("operationId is required");
        value = UUID.fromString(value).toString();
    }

    public static CheckoutOperationId from(String subject, String operationKey) {
        return new CheckoutOperationId(UUID.nameUUIDFromBytes(
            (lengthPrefixed(subject) + lengthPrefixed(operationKey)).getBytes(StandardCharsets.UTF_8)
        ).toString());
    }

    private static String lengthPrefixed(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("checkout identity parts are required");
        return value.getBytes(StandardCharsets.UTF_8).length + ":" + value;
    }
}
