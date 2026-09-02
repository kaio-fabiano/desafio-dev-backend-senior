package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.adapter.provider.DeterministicPaymentProvider;
import dev.desafio.transaction.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class PaymentHandlerTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-27T12:00:00Z"), ZoneOffset.UTC);

    @Test
    @DisplayName("AC-043: concurrent Card redelivery records one authorization @spec:AC-043")
    void authorizesCardOnceAcrossConcurrentRedelivery() throws Exception {
        var repository = new AtomicRepository();
        var handler = new PaymentHandler(repository, new DeterministicPaymentProvider(), CLOCK);
        var incomingEventId = UUID.randomUUID();
        var command = new Payment.PaymentRequested(
            "checkout-43", "payment-43", "order-43", Payment.Method.CARD,
            new BigDecimal("149.90"), "BRL", "provider-token", "buyer@example.test", "visa"
        );

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> handler.handle(incomingEventId, command));
            var second = executor.submit(() -> handler.handle(incomingEventId, command));

            assertEquals(first.get().outgoingEvent(), second.get().outgoingEvent());
        }
        assertEquals(1, repository.effectCount("CARD_AUTHORIZATION"));
        assertEquals(1, repository.inboxCount());
        assertEquals(1, repository.outboxCount());
        assertEquals("payment.authorized", repository.onlyEvent().eventType());
        assertEquals("payment-43", repository.onlyEvent().payload().get("paymentId"));
        assertEquals("order-43", repository.onlyEvent().payload().get("orderId"));
    }

    @Test
    @DisplayName("AC-044: Pix code and terminal result stay stable for one operation @spec:AC-044")
    void generatesStablePixCodeWithoutInventoryRequest() {
        var repository = new AtomicRepository();
        var handler = new PaymentHandler(repository, new DeterministicPaymentProvider(), CLOCK);
        var command = new Payment.PaymentRequested(
            "checkout-44", "payment-44", "order-44", Payment.Method.PIX,
            new BigDecimal("82.50"), "BRL", null, "buyer@example.test", null
        );

        var first = handler.handle(UUID.randomUUID(), command);
        var duplicateOperation = handler.handle(UUID.randomUUID(), command);

        assertEquals(first.outgoingEvent(), duplicateOperation.outgoingEvent());
        assertEquals(first.payment().pixCode(), duplicateOperation.payment().pixCode());
        assertEquals(Payment.Status.PIX_GENERATED, duplicateOperation.payment().status());
        assertEquals(1, repository.effectCount("PIX_CODE_GENERATION"));
        assertEquals(1, repository.outboxCount());
        assertEquals(2, repository.inboxCount());
        assertEquals("payment.pix-generated", first.outgoingEvent().eventType());
        assertFalse(repository.events().keySet().stream().anyMatch(type -> type.startsWith("stock.")));
    }

    @Test
    @DisplayName("AC-049: duplicate compensation requests record one refund @spec:AC-049")
    void refundsAuthorizedCardOnce() {
        var repository = new AtomicRepository();
        var handler = new PaymentHandler(repository, new DeterministicPaymentProvider(), CLOCK);
        handler.handle(UUID.randomUUID(), new Payment.PaymentRequested(
            "checkout-49", "payment-49", "order-49", Payment.Method.CARD,
            new BigDecimal("31.00"), "BRL", "provider-token", "buyer@example.test", "visa"
        ));
        var refund = new Payment.RefundRequested(
            "checkout-49", "payment-49", "order-49", "INSUFFICIENT_STOCK"
        );

        var first = handler.handle(UUID.randomUUID(), refund);
        var duplicate = handler.handle(UUID.randomUUID(), refund);

        assertEquals(Payment.Status.REFUNDED, duplicate.payment().status());
        assertEquals(first.outgoingEvent(), duplicate.outgoingEvent());
        assertEquals("payment.refunded", first.outgoingEvent().eventType());
        assertEquals(1, repository.effectCount("REFUND"));
        assertEquals(2, repository.outboxCount());
    }

    private static final class AtomicRepository implements PaymentRepository {
        private final Map<UUID, ProcessingResult> inbox = new HashMap<>();
        private final Map<String, Payment> payments = new HashMap<>();
        private final Map<String, Payment.OutgoingEvent> outbox = new HashMap<>();
        private final Map<String, Integer> effects = new HashMap<>();

        @Override
        public synchronized String providerReference(Payment.RefundRequested command) {
            var payment = payments.get(command.operationKey());
            if (payment == null) throw new IllegalStateException("authorized payment does not exist");
            return payment.providerReference();
        }

        @Override
        public synchronized ProcessingResult process(
            UUID incomingEventId,
            Payment.Command command,
            PaymentProvider.Result providerResult,
            Instant occurredAt
        ) {
            var previous = inbox.get(incomingEventId);
            if (previous != null) return new ProcessingResult(previous.payment(), previous.outgoingEvent(), true);

            Payment payment;
            Payment.Status resultStatus;
            String effectType;
            if (command instanceof Payment.PaymentRequested requested) {
                var proposed = Payment.fromProvider(requested, providerResult.toDomainResult());
                payment = payments.computeIfAbsent(requested.operationKey(), ignored -> proposed);
                if (!payment.hasSameIdentity(proposed)) throw new IllegalArgumentException("conflicting payment identity");
                resultStatus = providerResult.status();
                effectType = requested.method() == Payment.Method.CARD
                    ? "CARD_AUTHORIZATION"
                    : "PIX_CODE_GENERATION";
            } else {
                var refund = (Payment.RefundRequested) command;
                payment = payments.get(refund.operationKey());
                if (payment == null) throw new IllegalStateException("authorized payment does not exist");
                payment = payment.refund(refund, providerResult.toDomainResult());
                payments.put(refund.operationKey(), payment);
                resultStatus = Payment.Status.REFUNDED;
                effectType = "REFUND";
            }

            var effectKey = payment.paymentId() + ':' + effectType;
            effects.putIfAbsent(effectKey, 1);
            var processedPayment = payment;
            var processedStatus = resultStatus;
            var event = outbox.computeIfAbsent(
                effectKey,
                ignored -> Payment.resultEvent(processedPayment, processedStatus, occurredAt)
            );
            var result = new ProcessingResult(payment, event, false);
            inbox.put(incomingEventId, result);
            return result;
        }

        int effectCount(String effectType) {
            return (int) effects.keySet().stream().filter(key -> key.endsWith(':' + effectType)).count();
        }

        int inboxCount() {
            return inbox.size();
        }

        int outboxCount() {
            return outbox.size();
        }

        Payment.OutgoingEvent onlyEvent() {
            return outbox.values().iterator().next();
        }

        Map<String, Payment.OutgoingEvent> events() {
            var byType = new HashMap<String, Payment.OutgoingEvent>();
            outbox.values().forEach(event -> byType.put(event.eventType(), event));
            return byType;
        }
    }
}
