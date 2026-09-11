package dev.desafio.transaction.payment.domain.event;

import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

import java.time.Instant;

@Event(namespace = "payment", name = "PaymentPending", version = "1.0.0")
public record PaymentPending(
    @EventTag String paymentId,
    String transactionId,
    String providerReference,
    String pixCode,
    String correlationId,
    String causationId,
    Instant occurredAt
) {}
