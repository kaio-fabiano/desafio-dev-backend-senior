package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.domain.Inventory;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Comparator;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public final class InventoryService {
    private final InventoryRepository repository;
    private final StockPort stock;
    private final Clock clock;

    public InventoryService(InventoryRepository repository, StockPort stock) {
        this(repository, stock, Clock.systemUTC());
    }

    public InventoryService(InventoryRepository repository, StockPort stock, Clock clock) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.stock = Objects.requireNonNull(stock, "stock");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public Inventory.ProcessingResult handle(Inventory.ReservationRequested request) {
        Objects.requireNonNull(request, "request");
        var claim = repository.claim(request, fingerprint(request));
        if (claim.status() == InventoryRepository.ClaimStatus.COMPLETED) {
            return new Inventory.ProcessingResult(claim.completedEvent(), true);
        }
        if (claim.status() == InventoryRepository.ClaimStatus.BUSY) {
            throw new WorkInProgressException();
        }

        Inventory.OutgoingEvent proposed;
        var state = stock.reconcile(request);
        if (state == Inventory.StockState.RESERVED) {
            proposed = event(
                request,
                "stock.reserved",
                Map.of("orderId", request.orderId(), "reservationId", request.operationKey())
            );
        } else if (state == Inventory.StockState.INSUFFICIENT) {
            proposed = event(
                request,
                "stock.reservation-failed",
                Map.of("orderId", request.orderId(), "reason", "INSUFFICIENT_STOCK")
            );
        } else {
            try {
                stock.reserve(request);
                proposed = event(
                    request,
                    "stock.reserved",
                    Map.of("orderId", request.orderId(), "reservationId", request.operationKey())
                );
            } catch (Inventory.InsufficientStockException error) {
                proposed = event(
                    request,
                    "stock.reservation-failed",
                    Map.of("orderId", request.orderId(), "reason", "INSUFFICIENT_STOCK")
                );
            }
        }

        return new Inventory.ProcessingResult(repository.complete(claim, proposed), false);
    }

    private Inventory.OutgoingEvent event(
        Inventory.ReservationRequested request,
        String eventType,
        Map<String, String> payload
    ) {
        var eventId = UUID.nameUUIDFromBytes(
            stableMaterial(request.operationKey(), request.orderId(), eventType)
                .getBytes(StandardCharsets.UTF_8)
        );
        return new Inventory.OutgoingEvent(
            eventId,
            eventType,
            "v1",
            request.operationKey(),
            clock.instant(),
            payload
        );
    }

    private static String fingerprint(Inventory.ReservationRequested request) {
        var items = request.items().stream()
            .sorted(Comparator.comparing(Inventory.StockItem::productId)
                .thenComparingInt(Inventory.StockItem::quantity))
            .map(item -> item.productId().length() + ":" + item.productId() + ":" + item.quantity())
            .toList();
        return UUID.nameUUIDFromBytes(
            stableMaterial(request.operationKey(), request.orderId(), String.join("|", items))
                .getBytes(StandardCharsets.UTF_8)
        ).toString();
    }

    private static String stableMaterial(String operationKey, String orderId, String suffix) {
        return operationKey.length() + ":" + operationKey
            + orderId.length() + ":" + orderId
            + suffix.length() + ":" + suffix;
    }

    public static final class WorkInProgressException extends RuntimeException {
        public WorkInProgressException() {
            super("Inventory operation is already claimed");
        }
    }
}
