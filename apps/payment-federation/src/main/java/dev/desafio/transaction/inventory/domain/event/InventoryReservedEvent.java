package dev.desafio.transaction.inventory.domain.event;

import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;

import java.time.Instant;
import java.util.List;
import java.math.BigDecimal;

public record InventoryReservedEvent(
    String inventoryReservationId,
    String transactionId,
    String orderId,
    List<StockItem> items,
    String paymentId,
    String paymentOperationKey,
    String paymentMethod,
    String providerToken,
    String paymentMethodId,
    BigDecimal amount,
    String currency,
    String payerEmail,
    long version,
    String correlationId,
    String causationId,
    Instant occurredAt
) {
    public InventoryReservedEvent(
        String inventoryReservationId,
        String transactionId,
        String orderId,
        List<StockItem> items,
        long version,
        String correlationId,
        String causationId,
        Instant occurredAt
    ) {
        this(
            inventoryReservationId, transactionId, orderId, items, transactionId,
            correlationId + ":payment", "PIX", null, null, BigDecimal.ONE, "BRL",
            transactionId + "@example.test", version, correlationId, causationId, occurredAt
        );
    }

    public InventoryReservedEvent {
        items = List.copyOf(items);
        if ("CARD".equals(paymentMethod)) {
            if (providerToken == null || providerToken.isBlank()) {
                throw new IllegalArgumentException(InventoryErrorMessages.PROVIDER_TOKEN_REQUIRED);
            }
            if (paymentMethodId == null || paymentMethodId.isBlank()) {
                throw new IllegalArgumentException(InventoryErrorMessages.PAYMENT_METHOD_ID_REQUIRED);
            }
        } else if ((providerToken != null && !providerToken.isBlank())
            || (paymentMethodId != null && !paymentMethodId.isBlank())) {
            throw new IllegalArgumentException(InventoryErrorMessages.PIX_CARD_FIELDS_FORBIDDEN);
        }
    }
}
