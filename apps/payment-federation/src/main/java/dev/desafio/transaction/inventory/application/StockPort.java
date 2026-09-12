package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.inventory.domain.StockItem;

import java.util.List;

@FunctionalInterface
public interface StockPort {
    void reserve(Inventory.ReservationRequested request);

    default Inventory.StockState reconcile(Inventory.ReservationRequested request) {
        return Inventory.StockState.AVAILABLE;
    }

    default boolean isAvailable(List<StockItem> items) {
        return true;
    }
}
