package dev.desafio.transaction.inventory.application.query;

import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Objects;

public final class FindInventoryReservationByTransactionHandler {
    private final InventoryViewRepository views;

    public FindInventoryReservationByTransactionHandler(InventoryViewRepository views) {
        this.views = Objects.requireNonNull(views, "views");
    }

    @QueryHandler
    public InventoryReservationView handle(FindInventoryReservationByTransaction query) {
        return views.findByTransactionId(query.transactionId()).orElse(null);
    }
}
