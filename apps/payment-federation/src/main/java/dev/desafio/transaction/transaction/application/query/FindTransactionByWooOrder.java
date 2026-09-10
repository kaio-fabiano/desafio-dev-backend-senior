package dev.desafio.transaction.transaction.application.query;

public record FindTransactionByWooOrder(String wooOrderId, String owner) {
    public FindTransactionByWooOrder {
        wooOrderId = required(wooOrderId, "wooOrderId");
        owner = required(owner, "owner");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
