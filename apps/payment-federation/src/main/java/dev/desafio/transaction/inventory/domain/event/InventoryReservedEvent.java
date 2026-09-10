package dev.desafio.transaction.inventory.domain.event;

import dev.desafio.transaction.inventory.domain.StockItem;

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
    BigDecimal amount,
    String currency,
    String payerEmail,
    String providerToken,
    String paymentMethodId,
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
        String paymentId,
        String paymentOperationKey,
        String paymentMethod,
        BigDecimal amount,
        String currency,
        String payerEmail,
        long version,
        String correlationId,
        String causationId,
        Instant occurredAt
    ) {
        this(
            inventoryReservationId, transactionId, orderId, items, paymentId, paymentOperationKey,
            paymentMethod, amount, currency, payerEmail, null, null, version, correlationId,
            causationId, occurredAt
        );
    }

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
            correlationId + ":payment", "PIX", BigDecimal.ONE, "BRL",
            transactionId + "@example.test", null, null, version, correlationId, causationId,
            occurredAt
        );
    }

    public InventoryReservedEvent {
        items = List.copyOf(items);
    }
}
