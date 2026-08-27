package dev.desafio.payment.adapter.messaging;

import dev.desafio.payment.adapter.persistence.PaymentRepository;
import dev.desafio.payment.application.PaymentHandler;
import dev.desafio.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PaymentRedeliveryTest {
    @Test
    @DisplayName("AC-051: redelivery after commit before acknowledgement suppresses the repeated effect @spec:AC-051")
    void acknowledgesRedeliveryWithoutRepeatingCommittedWork() {
        var repository = new RedeliveryRepository();
        var handler = new PaymentHandler(
            repository,
            Clock.fixed(Instant.parse("2026-08-27T12:00:00Z"), ZoneOffset.UTC)
        );
        var consumer = new PaymentConsumer(handler);
        var delivery = PaymentConsumer.Delivery.paymentRequested(
            UUID.randomUUID(), "checkout-51", "payment-51", "order-51",
            Payment.Method.CARD, new BigDecimal("75.00"), "BRL"
        );

        assertThrows(SimulatedCrash.class, () -> consumer.consume(delivery, () -> {
            throw new SimulatedCrash();
        }));
        var acknowledgements = new AtomicInteger();
        var redelivered = consumer.consume(delivery, acknowledgements::incrementAndGet);

        assertEquals(1, acknowledgements.get());
        assertEquals(1, repository.effectCount);
        assertEquals(1, repository.inbox.size());
        assertEquals(1, repository.outbox.size());
        assertEquals("payment.authorized", redelivered.outgoingEvent().eventType());
        assertEquals(true, redelivered.duplicateDelivery());
    }

    private static final class RedeliveryRepository implements PaymentRepository {
        private final Map<UUID, ProcessingResult> inbox = new HashMap<>();
        private final Map<String, Payment.OutgoingEvent> outbox = new HashMap<>();
        private int effectCount;

        @Override
        public synchronized ProcessingResult process(
            UUID incomingEventId,
            Payment.Command command,
            Instant occurredAt
        ) {
            var previous = inbox.get(incomingEventId);
            if (previous != null) return new ProcessingResult(previous.payment(), previous.outgoingEvent(), true);

            var payment = Payment.start((Payment.PaymentRequested) command);
            var event = outbox.computeIfAbsent(payment.operationKey(), ignored -> {
                effectCount++;
                return Payment.resultEvent(payment, Payment.Status.AUTHORIZED, occurredAt);
            });
            var result = new ProcessingResult(payment, event, false);
            inbox.put(incomingEventId, result);
            return result;
        }
    }

    private static final class SimulatedCrash extends RuntimeException {}
}
