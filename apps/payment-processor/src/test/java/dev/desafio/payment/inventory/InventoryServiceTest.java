package dev.desafio.payment.inventory;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InventoryServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-31T12:00:00Z"), ZoneOffset.UTC);

    @Test
    @DisplayName("AC-112: duplicate insufficient-stock reactions produce one compensating result @spec:AC-112")
    void publishesOneStableFailureForConcurrentRedelivery() throws Exception {
        var repository = new MemoryRepository();
        var reservations = new AtomicInteger();
        var service = new InventoryService(repository, request -> {
            reservations.incrementAndGet();
            throw new InventoryService.InsufficientStockException();
        }, CLOCK);
        var request = new InventoryService.ReservationRequested(
            UUID.randomUUID(),
            "checkout-112",
            "order-112",
            new ArrayList<>(java.util.List.of(new InventoryService.StockItem("1001", 2)))
        );

        InventoryService.ProcessingResult first;
        InventoryService.ProcessingResult duplicate;
        try (var executor = Executors.newFixedThreadPool(2)) {
            var firstDelivery = executor.submit(() -> service.handle(request));
            var secondDelivery = executor.submit(() -> service.handle(request));
            first = firstDelivery.get();
            duplicate = secondDelivery.get();
        }

        assertEquals(1, reservations.get());
        assertEquals(first.event(), duplicate.event());
        assertEquals("stock.reservation-failed", first.event().eventType());
        assertEquals("INSUFFICIENT_STOCK", first.event().payload().get("reason"));
        assertEquals(1, repository.events.size());
    }

    private static final class MemoryRepository implements InventoryRepository {
        private final Map<String, InventoryService.OutgoingEvent> events = new HashMap<>();

        @Override
        public synchronized Optional<InventoryService.OutgoingEvent> find(UUID eventId, String operationKey) {
            return Optional.ofNullable(events.get(operationKey));
        }

        @Override
        public synchronized StoredResult save(UUID eventId, InventoryService.OutgoingEvent event) {
            var stored = events.putIfAbsent(event.operationKey(), event);
            return new StoredResult(stored == null ? event : stored, stored == null);
        }
    }
}
