package dev.desafio.transaction.inventory.domain;

public record StockItem(String productId, int quantity) {
    public StockItem {
        if (productId == null || productId.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.PRODUCT_ID_REQUIRED);
        }
        if (quantity < 1) {
            throw new IllegalArgumentException(InventoryErrorMessages.QUANTITY_MUST_BE_POSITIVE);
        }
    }
}
