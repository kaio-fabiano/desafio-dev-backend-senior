package dev.desafio.transaction.inventory.domain;

@FunctionalInterface
public interface InventoryEventPublisher {
    void raise(Object event);
}
