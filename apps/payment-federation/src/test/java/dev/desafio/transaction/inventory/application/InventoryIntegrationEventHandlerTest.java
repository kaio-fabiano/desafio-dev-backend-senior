package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.application.event.InventoryIntegrationMessage;
import dev.desafio.transaction.inventory.application.event.InventoryIntegrationEventHandler;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedAxonEvent;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class InventoryIntegrationEventHandlerTest {
    @Test
    @DisplayName("Pix Inventory events omit Card credentials @spec:AC-293 @spec:AC-314")
    void mapsOwnedResultWithCausalMetadata() {
        var published = new ArrayList<InventoryIntegrationMessage>();
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
        assertFalse(published.getFirst().payload().containsKey("providerCredentialReference"));
        assertFalse(published.getFirst().payload().containsKey("paymentMethodId"));
    }

    @Test
    @DisplayName("Card reservation publishes the exact tokenized credentials @spec:AC-286 @spec:AC-293 @spec:AC-314")
    void cardReservationPublishesOpaquePaymentReference() {
        var published = new ArrayList<InventoryIntegrationMessage>();
        var handler = new InventoryIntegrationEventHandler((source, event) -> published.add(event));

        handler.on(new InventoryReservedAxonEvent("tx-card", new InventoryReservedEvent(
            "inventory:tx-card", "tx-card", "order-card", List.of(new StockItem("1001", 1)),
            "payment:tx-card", "operation-card:payment", "CARD", "provider-token-card", "visa",
            new BigDecimal("19.90"), "BRL", "buyer@example.test", 1,
            "operation-card", "event-card", Instant.EPOCH
        )));

        var payload = published.getFirst().payload();
        assertEquals("provider-token-card", payload.get("providerCredentialReference"));
        assertEquals("visa", payload.get("paymentMethodId"));
        assertFalse(payload.containsKey("providerToken"));
    }
}
