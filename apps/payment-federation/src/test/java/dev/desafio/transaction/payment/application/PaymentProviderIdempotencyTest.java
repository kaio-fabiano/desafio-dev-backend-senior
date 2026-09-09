package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PaymentProviderIdempotencyTest {
    @Test
    @DisplayName("Payment provider effects execute once across duplicate delivery @spec:AC-283")
    void paymentProviderEffectsExecuteOnceAcrossDuplicateDelivery() {
        var providerCalls = new AtomicInteger();
        PaymentProvider provider = command -> {
            providerCalls.incrementAndGet();
            return new PaymentProvider.Result("provider-247", Payment.Status.AUTHORIZED, null);
        };
        var handler = new PaymentHandler(new ReplayableRepository(), provider);
        var deliveryId = UUID.randomUUID();
        var command = new Payment.PaymentRequested(
            "operation-247",
            "payment-247",
            "order-247",
            Payment.Method.CARD,
            new BigDecimal("42.50"),
            "BRL",
            "short-lived-token",
            "buyer@example.test",
            "visa"
        );

        handler.handle(deliveryId, command);
        handler.handle(deliveryId, command);

        assertEquals(1, providerCalls.get());
    }

    private static final class ReplayableRepository implements PaymentRepository {
        private final Map<UUID, ProcessingResult> processed = new HashMap<>();

        @Override
        public synchronized java.util.Optional<ProcessingResult> processed(
            UUID incomingEventId,
            Payment.Command command
        ) {
            return java.util.Optional.ofNullable(processed.get(incomingEventId))
                .map(result -> new ProcessingResult(result.payment(), result.outgoingEvent(), true));
        }

        @Override
        public String providerReference(Payment.RefundRequested command) {
            throw new UnsupportedOperationException();
        }

        @Override
        public synchronized ProcessingResult process(
            UUID incomingEventId,
            Payment.Command command,
            PaymentProvider.Result providerResult,
            Instant occurredAt
        ) {
            var previous = processed.get(incomingEventId);
            if (previous != null) {
                return new ProcessingResult(previous.payment(), previous.outgoingEvent(), true);
            }
            var payment = Payment.fromProvider(
                (Payment.PaymentRequested) command,
                providerResult.toDomainResult()
            );
            var result = new ProcessingResult(payment, Payment.resultEvent(payment, occurredAt), false);
            processed.put(incomingEventId, result);
            return result;
        }
    }
}
