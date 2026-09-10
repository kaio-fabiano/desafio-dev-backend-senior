package dev.desafio.transaction.inventory.domain;

import dev.desafio.transaction.inventory.domain.event.InventoryCommittedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReleasedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InventoryReservationTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");

    @Test
    @DisplayName("Inventory decisions are idempotent and stale facts cannot regress state @spec:AC-284")
    void decisionsAreIdempotentAndDoNotRegress() {
        var events = new ArrayList<Object>();
        var reservation = reserved(events);

        assertTrue(reservation.release("correlation", "payment-rejected", NOW, events::add));
        assertFalse(reservation.release("correlation", "duplicate", NOW, events::add));
        assertFalse(reservation.commit("correlation", "late-approval", NOW, events::add));

        assertEquals(InventoryReservation.Status.RELEASED, reservation.status());
        assertEquals(2, reservation.version());
        assertEquals(List.of(InventoryReservedEvent.class, InventoryReleasedEvent.class),
            events.stream().map(Object::getClass).toList());
        assertThrows(IllegalArgumentException.class, () -> new StockItem("sku", 0));
    }

    @Test
    @DisplayName("Replay rebuilds Inventory state without invoking an external stock effect @spec:AC-282")
    void replayRebuildsStateWithoutEffects() {
        var events = new ArrayList<Object>();
        var decided = reserved(events);
        decided.commit("correlation", "payment-approved", NOW, events::add);

        var replayed = new InventoryReservation((InventoryReservedEvent) events.get(0));
        replayed.on((InventoryCommittedEvent) events.get(1));
        replayed.on((InventoryCommittedEvent) events.get(1));

        assertEquals(InventoryReservation.Status.COMMITTED, replayed.status());
        assertEquals(2, replayed.version());
        assertEquals("tx-246", replayed.transactionId());
    }

    private InventoryReservation reserved(List<Object> events) {
        return InventoryReservation.decide(
            "tx-246", "tx-246", "order-246", List.of(new StockItem("sku-1", 1)),
            true, "correlation", "order-received", NOW, events::add
        );
    }
}
