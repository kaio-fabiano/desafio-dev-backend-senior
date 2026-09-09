package dev.desafio.transaction.inventory.domain;

public record StockItem(String productId, int quantity) {
    public StockItem {
        if (productId == null || productId.isBlank()) {
            throw new IllegalArgumentException("productId is required");
        }
        if (quantity < 1) throw new IllegalArgumentException("quantity must be positive");
    }
}
