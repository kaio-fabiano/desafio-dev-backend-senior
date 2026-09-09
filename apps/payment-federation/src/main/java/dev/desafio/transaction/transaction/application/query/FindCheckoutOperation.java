package dev.desafio.transaction.transaction.application.query;

public record FindCheckoutOperation(String id, String owner) {
    public FindCheckoutOperation {
        id = required(id, "id");
        owner = required(owner, "owner");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
