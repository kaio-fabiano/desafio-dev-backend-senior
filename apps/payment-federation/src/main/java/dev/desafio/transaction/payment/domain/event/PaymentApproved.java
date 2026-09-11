package dev.desafio.transaction.payment.domain.event;

import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

import java.time.Instant;

@Event(namespace = "payment", name = "PaymentApproved", version = "1.0.0")
public record PaymentApproved(
    @EventTag String paymentId,
    String transactionId,
    String providerReference,
    String correlationId,
    String causationId,
    Instant occurredAt
) {}
