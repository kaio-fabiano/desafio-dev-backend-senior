package dev.desafio.transaction.inventory.application.command;

import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;
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
    String providerToken,
    String paymentMethodId,
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
        String paymentId,
        String paymentOperationKey,
        String paymentMethod,
        BigDecimal amount,
        String currency,
        String payerEmail,
        String correlationId,
        String causationId
    ) {
        this(
            inventoryReservationId, incomingEventId, operationKey, transactionId, orderId, items,
            paymentId, paymentOperationKey, paymentMethod, amount, currency, payerEmail, null, null,
            correlationId, causationId
        );
    }

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
            transactionId + "@example.test", null, null, correlationId, causationId
        );
    }

    public ReserveInventoryCommand {
        items = List.copyOf(items);
        if (paymentId == null || paymentId.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.PAYMENT_ID_REQUIRED);
        }
        if (paymentOperationKey == null || paymentOperationKey.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.PAYMENT_OPERATION_KEY_REQUIRED);
        }
        if (paymentMethod == null || paymentMethod.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.PAYMENT_METHOD_REQUIRED);
        }
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException(InventoryErrorMessages.AMOUNT_MUST_BE_POSITIVE);
        }
        if (currency == null || currency.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.CURRENCY_REQUIRED);
        }
        if (payerEmail == null || payerEmail.isBlank()) {
            throw new IllegalArgumentException(InventoryErrorMessages.PAYER_EMAIL_REQUIRED);
        }
    }
}
