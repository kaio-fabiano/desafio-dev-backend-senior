package dev.desafio.transaction.payment.application.axon;

import dev.desafio.transaction.payment.application.PaymentIntegrationEventPublisher;
import dev.desafio.transaction.payment.application.event.PaymentApproved;
import dev.desafio.transaction.payment.application.event.PaymentPending;
import dev.desafio.transaction.payment.application.event.PaymentRefunded;
import dev.desafio.transaction.payment.application.event.PaymentRejected;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;

import java.util.LinkedHashMap;
import java.util.Map;

public final class PaymentIntegrationEventHandler {
    private final PaymentIntegrationEventPublisher publisher;

    public PaymentIntegrationEventHandler(PaymentIntegrationEventPublisher publisher) {
        this.publisher = java.util.Objects.requireNonNull(publisher, "publisher");
    }

    @EventHandler
    public void on(PaymentPending event) {
        var payload = payload(event.paymentId(), event.transactionId(), event.providerReference());
        if (event.pixCode() != null) payload.put("pixCode", event.pixCode());
        publish("payment.pending.v1", event.paymentId(), event.transactionId(), event.correlationId(),
            event.causationId(), event.occurredAt(), payload);
    }

    @EventHandler
    public void on(PaymentApproved event) {
        publish("payment.approved.v1", event.paymentId(), event.transactionId(), event.correlationId(),
            event.causationId(), event.occurredAt(),
            payload(event.paymentId(), event.transactionId(), event.providerReference()));
    }

    @EventHandler
    public void on(PaymentRejected event) {
        var payload = payload(event.paymentId(), event.transactionId(), event.providerReference());
        payload.put("reason", event.reason());
        publish("payment.rejected.v1", event.paymentId(), event.transactionId(), event.correlationId(),
            event.causationId(), event.occurredAt(), payload);
    }

    @EventHandler
    public void on(PaymentRefunded event) {
        publish("payment.refunded.v1", event.paymentId(), event.transactionId(), event.correlationId(),
            event.causationId(), event.occurredAt(),
            payload(event.paymentId(), event.transactionId(), event.providerReference()));
    }

    private void publish(
        String eventType,
        String paymentId,
        String transactionId,
        String correlationId,
        String causationId,
        java.time.Instant occurredAt,
        Map<String, Object> payload
    ) {
        publisher.publish(
            eventType + ':' + paymentId,
            eventType,
            paymentId,
            transactionId,
            correlationId,
            causationId,
            occurredAt,
            payload
        );
    }

    private LinkedHashMap<String, Object> payload(
        String paymentId,
        String transactionId,
        String providerReference
    ) {
        var payload = new LinkedHashMap<String, Object>();
        payload.put("paymentId", paymentId);
        payload.put("transactionId", transactionId);
        payload.put("providerReference", providerReference);
        return payload;
    }
}
