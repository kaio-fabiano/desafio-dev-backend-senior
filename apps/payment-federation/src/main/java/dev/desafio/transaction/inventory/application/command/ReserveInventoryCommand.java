package dev.desafio.transaction.inventory.application.command;

import dev.desafio.transaction.inventory.domain.StockItem;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.util.List;
import java.util.UUID;

@Command(namespace = "inventory", name = "ReserveInventory", version = "1.0.0")
public record ReserveInventoryCommand(
    @TargetEntityId String inventoryReservationId,
    UUID incomingEventId,
    String operationKey,
    String transactionId,
    String orderId,
    List<StockItem> items,
    String correlationId,
    String causationId
) {
    public ReserveInventoryCommand {
        items = List.copyOf(items);
    }
}
