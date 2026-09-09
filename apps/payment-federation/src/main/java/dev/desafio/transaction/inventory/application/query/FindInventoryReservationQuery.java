package dev.desafio.transaction.inventory.application.query;

import org.axonframework.messaging.queryhandling.annotation.Query;

@Query(namespace = "inventory", name = "FindInventoryReservation", version = "1.0.0")
public record FindInventoryReservationQuery(String inventoryReservationId) {}
