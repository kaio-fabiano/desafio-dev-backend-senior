package dev.desafio.transaction.inventory.application.query;

import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Optional;

public final class FindInventoryReservationQueryHandler {
    private final InventoryProjectionRepository projections;

    public FindInventoryReservationQueryHandler(InventoryProjectionRepository projections) {
        this.projections = projections;
    }

    @QueryHandler
    public Optional<InventoryReservationView> handle(FindInventoryReservationQuery query) {
        return projections.find(query.inventoryReservationId());
    }
}
