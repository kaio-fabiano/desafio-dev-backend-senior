package dev.desafio.transaction.inventory.application.command;

import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

@Command(namespace = "inventory", name = "CommitInventory", version = "1.0.0")
public record CommitInventoryCommand(
    @TargetEntityId String inventoryReservationId,
    String correlationId,
    String causationId
) {}
