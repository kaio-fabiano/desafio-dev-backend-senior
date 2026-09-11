package dev.desafio.transaction.inventory.application.event;

import dev.desafio.transaction.inventory.domain.event.InventoryCommittedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryCommitRejectedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReleasedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservationRejectedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedAxonEvent;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;

import java.util.LinkedHashMap;
import java.util.Map;

public final class InventoryIntegrationEventHandler {
    private final InventoryOutbox outbox;

    public InventoryIntegrationEventHandler(InventoryOutbox outbox) {
        this.outbox = outbox;
    }

    @EventHandler
    public void on(InventoryReservedAxonEvent message) {
        var event = message.payload();
        var payload = new LinkedHashMap<String, Object>();
        payload.put("orderId", event.orderId());
        payload.put("reservationId", event.inventoryReservationId());
        payload.put("items", event.items());
        payload.put("paymentId", event.paymentId());
        payload.put("paymentOperationKey", event.paymentOperationKey());
        payload.put("method", event.paymentMethod());
        payload.put("amount", event.amount());
        payload.put("currency", event.currency());
        payload.put("payerEmail", event.payerEmail());
        if ("CARD".equals(event.paymentMethod())) {
            payload.put("providerCredentialReference", event.providerToken());
            payload.put("paymentMethodId", event.paymentMethodId());
        }
        enqueue("inventory.reserved.v1", event.inventoryReservationId(), event.transactionId(),
            event.correlationId(), event.causationId(), event.occurredAt(), event.version(),
            payload);
    }

    @EventHandler
    public void on(InventoryReservationRejectedAxonEvent message) {
        var event = message.payload();
        enqueue("inventory.reservation-rejected.v1", event.inventoryReservationId(), event.transactionId(),
            event.correlationId(), event.causationId(), event.occurredAt(), event.version(),
            Map.of("orderId", event.orderId(), "reason", event.reason(), "items", event.items()));
    }

    @EventHandler
    public void on(InventoryCommittedAxonEvent message) {
        var event = message.payload();
        enqueue("inventory.committed.v1", event.inventoryReservationId(), event.transactionId(),
            event.correlationId(), event.causationId(), event.occurredAt(), event.version(),
            Map.of("orderId", event.orderId(), "reservationId", event.inventoryReservationId()));
    }

    @EventHandler
    public void on(InventoryCommitRejectedAxonEvent message) {
        var event = message.payload();
        enqueue("inventory.commit-rejected.v1", event.inventoryReservationId(), event.transactionId(),
            event.correlationId(), event.causationId(), event.occurredAt(), event.version(),
            Map.of("orderId", event.orderId(), "reservationId", event.inventoryReservationId(),
                "reason", event.reason()));
    }

    @EventHandler
    public void on(InventoryReleasedAxonEvent message) {
        var event = message.payload();
        enqueue("inventory.released.v1", event.inventoryReservationId(), event.transactionId(),
            event.correlationId(), event.causationId(), event.occurredAt(), event.version(),
            Map.of("orderId", event.orderId(), "reservationId", event.inventoryReservationId()));
    }

    private void enqueue(String eventType, String aggregateId, String transactionId,
                         String correlationId, String causationId, java.time.Instant occurredAt,
                         long version, Map<String, Object> payload) {
        outbox.enqueue(
            aggregateId + ":" + version + ":" + eventType,
            new InventoryIntegrationMessage(
                eventType, aggregateId, transactionId, correlationId, causationId, occurredAt, payload
            )
        );
    }
}
