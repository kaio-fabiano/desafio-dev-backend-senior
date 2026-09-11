package dev.desafio.transaction.inventory.application.event;

public interface InventoryOutbox {
    void enqueue(String sourceEventId, InventoryIntegrationMessage event);
}
