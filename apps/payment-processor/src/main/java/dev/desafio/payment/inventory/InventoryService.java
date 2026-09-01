package dev.desafio.payment.inventory;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class InventoryService {
    private final InventoryRepository repository;
    private final StockPort stock;
    private final Clock clock;
    private final ConcurrentHashMap<String, Object> inFlight = new ConcurrentHashMap<>();

    public InventoryService(InventoryRepository repository, StockPort stock) {
        this(repository, stock, Clock.systemUTC());
    }

    public InventoryService(InventoryRepository repository, StockPort stock, Clock clock) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.stock = Objects.requireNonNull(stock, "stock");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public ProcessingResult handle(ReservationRequested request) {
        Objects.requireNonNull(request, "request");
        var lock = inFlight.computeIfAbsent(request.operationKey(), ignored -> new Object());
        try {
            synchronized (lock) {
                return process(request);
            }
        } finally {
            inFlight.remove(request.operationKey(), lock);
        }
    }

    private ProcessingResult process(ReservationRequested request) {
        var previous = repository.find(request.eventId(), request.operationKey());
        if (previous.isPresent()) return new ProcessingResult(previous.orElseThrow(), true);

        OutgoingEvent proposed;
        try {
            stock.reserve(request);
            proposed = event(
                request,
                "stock.reserved",
                Map.of("orderId", request.orderId(), "reservationId", request.operationKey())
            );
        } catch (InsufficientStockException error) {
            proposed = event(
                request,
                "stock.reservation-failed",
                Map.of("orderId", request.orderId(), "reason", "INSUFFICIENT_STOCK")
            );
        }

        var stored = repository.save(request.eventId(), proposed);
        return new ProcessingResult(stored.event(), !stored.inserted());
    }

    private OutgoingEvent event(ReservationRequested request, String eventType, Map<String, String> payload) {
        var eventId = UUID.nameUUIDFromBytes(
            stableMaterial(request.operationKey(), request.orderId(), eventType).getBytes(StandardCharsets.UTF_8)
        );
        return new OutgoingEvent(
            eventId,
            eventType,
            "v1",
            request.operationKey(),
            clock.instant(),
            payload
        );
    }

    @FunctionalInterface
    public interface StockPort {
        void reserve(ReservationRequested request);
    }

    public static final class InsufficientStockException extends RuntimeException {
        public InsufficientStockException() {
            super("WooCommerce stock is insufficient");
        }
    }

    public record StockItem(String productId, int quantity) {
        public StockItem {
            productId = required(productId, "productId");
            if (quantity < 1) throw new IllegalArgumentException("quantity must be positive");
        }
    }

    public record ReservationRequested(
        UUID eventId,
        String operationKey,
        String orderId,
        List<StockItem> items
    ) {
        public ReservationRequested {
            Objects.requireNonNull(eventId, "eventId");
            operationKey = required(operationKey, "operationKey");
            orderId = required(orderId, "orderId");
            items = List.copyOf(items);
            if (items.isEmpty()) throw new IllegalArgumentException("items are required");
        }
    }

    public record OutgoingEvent(
        UUID eventId,
        String eventType,
        String eventVersion,
        String operationKey,
        Instant occurredAt,
        Map<String, String> payload
    ) {
        public OutgoingEvent {
            Objects.requireNonNull(eventId, "eventId");
            eventType = required(eventType, "eventType");
            eventVersion = required(eventVersion, "eventVersion");
            operationKey = required(operationKey, "operationKey");
            Objects.requireNonNull(occurredAt, "occurredAt");
            payload = Map.copyOf(payload);
        }
    }

    public record ProcessingResult(OutgoingEvent event, boolean duplicateDelivery) {}

    private static String stableMaterial(String operationKey, String orderId, String eventType) {
        return operationKey.length() + ":" + operationKey
            + orderId.length() + ":" + orderId
            + eventType.length() + ":" + eventType;
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
