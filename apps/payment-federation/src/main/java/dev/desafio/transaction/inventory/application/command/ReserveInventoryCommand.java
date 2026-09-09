package dev.desafio.transaction.inventory.application.command;

import dev.desafio.transaction.inventory.domain.StockItem;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;

@Command(namespace = "inventory", name = "ReserveInventory", version = "1.0.0")
public record ReserveInventoryCommand(
    @TargetEntityId String inventoryReservationId,
    UUID incomingEventId,
    String operationKey,
    String transactionId,
    String orderId,
    List<StockItem> items,
    String paymentId,
    String paymentOperationKey,
    String paymentMethod,
    BigDecimal amount,
    String currency,
    String payerEmail,
    String correlationId,
    String causationId
) {
    public ReserveInventoryCommand(
        String inventoryReservationId,
        UUID incomingEventId,
        String operationKey,
        String transactionId,
        String orderId,
        List<StockItem> items,
        String correlationId,
        String causationId
    ) {
        this(
            inventoryReservationId, incomingEventId, operationKey, transactionId, orderId, items,
            transactionId, correlationId + ":payment", "PIX", BigDecimal.ONE, "BRL",
            transactionId + "@example.test", correlationId, causationId
        );
    }

    public ReserveInventoryCommand {
        items = List.copyOf(items);
        if (paymentId == null || paymentId.isBlank()) throw new IllegalArgumentException("paymentId is required");
        if (paymentOperationKey == null || paymentOperationKey.isBlank()) {
            throw new IllegalArgumentException("paymentOperationKey is required");
        }
        if (paymentMethod == null || paymentMethod.isBlank()) throw new IllegalArgumentException("paymentMethod is required");
        if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("amount must be positive");
        if (currency == null || currency.isBlank()) throw new IllegalArgumentException("currency is required");
        if (payerEmail == null || payerEmail.isBlank()) throw new IllegalArgumentException("payerEmail is required");
    }
}
