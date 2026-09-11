package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.domain.Inventory;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InventoryServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-31T12:00:00Z"), ZoneOffset.UTC);

    @Test
    @DisplayName("AC-112: duplicate insufficient-stock reactions produce one compensating result @spec:AC-112")
    void publishesOneStableFailureForRedelivery() {
        var repository = new MemoryRepository();
        var reservations = new AtomicInteger();
        var service = new InventoryService(repository, request -> {
            reservations.incrementAndGet();
            throw new Inventory.InsufficientStockException();
        }, CLOCK);
        var request = request("checkout-112");

        var first = service.handle(request);
        var duplicate = service.handle(request);

        assertEquals(1, reservations.get());
        assertEquals(first.event(), duplicate.event());
        assertEquals("stock.reservation-failed", first.event().eventType());
        assertEquals("INSUFFICIENT_STOCK", first.event().payload().get("reason"));
        assertEquals(1, repository.events.size());
    }

    @Test
    @DisplayName("AC-134: claim is durable before the WooCommerce inventory effect @spec:AC-134")
    void persistsClaimBeforeCallingWooCommerce() {
        var repository = new MemoryRepository();
        var effectObservedClaim = new AtomicBoolean();
        var service = new InventoryService(repository, request ->
            effectObservedClaim.set(repository.hasClaim(request.operationKey())), CLOCK);

        var result = service.handle(request("checkout-134-claim"));

        assertTrue(effectObservedClaim.get());
        assertEquals("stock.reserved", result.event().eventType());
        assertTrue(repository.isCompleted("checkout-134-claim"));
    }

    @Test
    @DisplayName("AC-134: recovery reconciles WooCommerce before repeating an ambiguous effect @spec:AC-134")
    void reconcilesRemoteStateAfterAmbiguousFailure() {
        var repository = new MemoryRepository();
        var remoteReserved = new AtomicBoolean();
        var reservations = new AtomicInteger();
        var stock = new StockPort() {
            @Override
            public void reserve(Inventory.ReservationRequested request) {
                reservations.incrementAndGet();
                remoteReserved.set(true);
                throw new IllegalStateException("connection closed after WooCommerce committed");
            }

            @Override
            public Inventory.StockState reconcile(Inventory.ReservationRequested request) {
                return remoteReserved.get()
                    ? Inventory.StockState.RESERVED
                    : Inventory.StockState.AVAILABLE;
            }
        };
        var service = new InventoryService(repository, stock, CLOCK);
        var request = request("checkout-134-recovery");

        assertThrows(IllegalStateException.class, () -> service.handle(request));
        repository.expireClaim(request.operationKey());
        var recovered = service.handle(request);

        assertEquals(1, reservations.get());
        assertEquals("stock.reserved", recovered.event().eventType());
        assertTrue(repository.isCompleted(request.operationKey()));
    }

    @Test
    void activeDurableClaimPreventsConcurrentExternalEffect() {
        var repository = new MemoryRepository();
        var request = request("checkout-active-claim");
        var effects = new AtomicInteger();
        var service = new InventoryService(repository, ignored -> {
            effects.incrementAndGet();
            throw new IllegalStateException("ambiguous remote failure");
        }, CLOCK);

        assertThrows(IllegalStateException.class, () -> service.handle(request));
        assertThrows(InventoryService.WorkInProgressException.class, () -> service.handle(request));
        assertEquals(1, effects.get());
    }

    private static Inventory.ReservationRequested request(String operationKey) {
        return new Inventory.ReservationRequested(
            UUID.randomUUID(), operationKey, "order-112",
            List.of(new Inventory.StockItem("1001", 2))
        );
    }

    private static final class MemoryRepository implements InventoryRepository {
        private final Map<String, StoredOperation> operations = new HashMap<>();
        private final Map<String, Inventory.OutgoingEvent> events = new HashMap<>();

        @Override
        public synchronized Claim claim(Inventory.ReservationRequested request, String fingerprint) {
            var stored = operations.get(request.operationKey());
            if (stored != null && !stored.fingerprint.equals(fingerprint)) {
                throw new IllegalArgumentException("operationKey identifies a different inventory request");
            }
            if (stored != null && stored.event != null) {
                return new Claim(ClaimStatus.COMPLETED, request.eventId(), request.operationKey(), null, stored.event);
            }
            if (stored != null && !stored.expired) {
                return new Claim(ClaimStatus.BUSY, request.eventId(), request.operationKey(), null, null);
            }
            var owner = UUID.randomUUID();
            operations.put(request.operationKey(), new StoredOperation(fingerprint, owner, false, null));
            return new Claim(ClaimStatus.ACQUIRED, request.eventId(), request.operationKey(), owner, null);
        }

        @Override
        public synchronized Inventory.OutgoingEvent complete(Claim claim, Inventory.OutgoingEvent event) {
            var stored = operations.get(claim.operationKey());
            if (stored == null || !claim.ownerToken().equals(stored.owner)) {
                throw new IllegalStateException("inventory claim ownership was lost before completion");
            }
            var persisted = events.computeIfAbsent(event.operationKey(), ignored -> event);
            operations.put(claim.operationKey(), new StoredOperation(stored.fingerprint, null, false, persisted));
            return persisted;
        }

        synchronized void expireClaim(String operationKey) {
            var stored = operations.get(operationKey);
            operations.put(operationKey, new StoredOperation(stored.fingerprint, stored.owner, true, stored.event));
        }

        synchronized boolean hasClaim(String operationKey) {
            return operations.containsKey(operationKey);
        }

        synchronized boolean isCompleted(String operationKey) {
            var stored = operations.get(operationKey);
            return stored != null && stored.event != null;
        }

        private record StoredOperation(String fingerprint, UUID owner, boolean expired,
                                       Inventory.OutgoingEvent event) {}
    }
}
