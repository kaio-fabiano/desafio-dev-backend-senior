package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.application.event.InventoryIntegrationEvent;
import dev.desafio.transaction.inventory.application.event.InventoryIntegrationEventHandler;
import dev.desafio.transaction.inventory.application.axon.InventoryReservedAxonEvent;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InventoryIntegrationEventHandlerTest {
    @Test
    @DisplayName("Inventory maps only its result facts into its durable AMQP outbox @spec:AC-293")
    void mapsOwnedResultWithCausalMetadata() {
        var published = new ArrayList<InventoryIntegrationEvent>();
        var handler = new InventoryIntegrationEventHandler((source, event) -> published.add(event));
        var occurredAt = Instant.parse("2026-09-09T12:00:00Z");

        handler.on(new InventoryReservedAxonEvent("tx-246", new InventoryReservedEvent(
            "tx-246", "tx-246", "order-246", List.of(new StockItem("sku-1", 1)),
            1, "correlation-246", "causation-246", occurredAt
        )));

        assertEquals(1, published.size());
        assertEquals("inventory.reserved.v1", published.getFirst().eventType());
        assertEquals("tx-246", published.getFirst().transactionId());
        assertEquals("correlation-246", published.getFirst().correlationId());
        assertEquals("causation-246", published.getFirst().causationId());
    }
}
