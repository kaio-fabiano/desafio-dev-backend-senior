package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.domain.Inventory;

@FunctionalInterface
public interface StockPort {
    void reserve(Inventory.ReservationRequested request);

    default Inventory.StockState reconcile(Inventory.ReservationRequested request) {
        return Inventory.StockState.AVAILABLE;
    }
}
