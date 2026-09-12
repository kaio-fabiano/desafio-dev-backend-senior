package dev.desafio.transaction.payment.application.axon;

import dev.desafio.transaction.payment.application.event.PaymentProviderEffectHandler;
import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.payment.domain.event.PaymentRefundRequested;
import dev.desafio.transaction.payment.domain.event.PaymentRequested;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentProviderEffectHandlerTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    @DisplayName("Axon awaits payment and refund provider outcomes @spec:AC-296")
    void axonAwaitsPaymentAndRefundProviderOutcomes() throws Exception {
        var outcome = new CompletableFuture<Void>();
        var failure = new IllegalStateException("outcome command failed");
        var gateway = mock(CommandGateway.class);
        when(gateway.send(any(), eq(Void.class))).thenReturn(outcome);
        var handler = new PaymentProviderEffectHandler(
            new InMemoryLedger(), command -> approved(), gateway, CLOCK
        );

        for (var event : List.of(requested(), refundRequested())) {
            var method = List.of(handler.getClass().getDeclaredMethods()).stream()
                .filter(candidate -> candidate.isAnnotationPresent(EventHandler.class))
                .filter(candidate -> candidate.getParameterTypes()[0].equals(event.getClass()))
                .findFirst()
                .orElseThrow();

            assertEquals(CompletableFuture.class, method.getReturnType());
            assertEquals(1, method.getParameterCount());
            assertSame(outcome, method.invoke(handler, event));
        }

        assertFalse(outcome.isDone());
        outcome.completeExceptionally(failure);
        assertSame(failure, assertThrows(CompletionException.class, outcome::join).getCause());
    }

    @Test
    @DisplayName("Committed provider effects are not repeated by Axon redelivery @spec:AC-283")
    void committedProviderEffectsAreNotRepeatedByAxonRedelivery() {
        var ledger = new InMemoryLedger();
        var executions = new AtomicInteger();
        PaymentProvider provider = command -> {
            executions.incrementAndGet();
            return approved();
        };
        var handler = new PaymentProviderEffectHandler(ledger, provider, commandGateway(), CLOCK);
        var event = requested();

        handler.execute(event).join();
        handler.execute(event).join();

        assertEquals(1, executions.get());
        assertEquals(1, ledger.results.size());
    }

    @Test
    @DisplayName("Ambiguous provider success is reconciled without repeating the effect by retrying its idempotent operation @spec:AC-283 @spec:AC-297")
    void ambiguousProviderSuccessIsReconciledWithoutRepeatingTheEffect() {
        var ledger = new InMemoryLedger();
        var executions = new AtomicInteger();
        var operationKeys = new ArrayList<String>();
        PaymentProvider provider = command -> {
            operationKeys.add(command.operationKey());
            if (executions.getAndIncrement() == 0) {
                throw new IllegalStateException("timeout after provider success");
            }
            return approved();
        };
        var handler = new PaymentProviderEffectHandler(ledger, provider, commandGateway(), CLOCK);
        var event = requested();

        assertThrows(IllegalStateException.class, () -> handler.execute(event));
        handler.execute(event).join();

        assertEquals(2, executions.get());
        assertEquals(List.of(event.operationKey(), event.operationKey()), operationKeys);
        assertEquals(1, ledger.results.size());
    }

    @Test
    @DisplayName("Incomplete refund claims retry only their matching provider operation @spec:AC-297")
    void incompleteRefundClaimsRetryOnlyTheirMatchingProviderOperation() {
        var ledger = new InMemoryLedger();
        var executions = new AtomicInteger();
        var reconciliations = new AtomicInteger();
        var event = refundRequested();
        var effectId = Payment.stableUuid(event.operationKey(), event.paymentId(), "PROVIDER_REFUND");
        ledger.claim(new PaymentEffectLedger.Effect(
            effectId, event.paymentId(), event.operationKey(),
            PaymentEffectLedger.Type.PROVIDER_REFUND, event.occurredAt()
        ));
        var refunded = new PaymentProvider.Result("provider-283", Payment.Status.REFUNDED, null);
        var provider = new PaymentProvider() {
            @Override
            public Result execute(Payment.ProviderRequest command) {
                executions.incrementAndGet();
                assertEquals(event.operationKey(), command.operationKey());
                return refunded;
            }

            @Override
            public Result reconcile(Payment.ProviderRequest command) {
                reconciliations.incrementAndGet();
                return approved();
            }
        };

        new PaymentProviderEffectHandler(ledger, provider, commandGateway(), CLOCK)
            .execute(event)
            .join();

        assertEquals(1, executions.get());
        assertEquals(0, reconciliations.get());
        assertEquals(refunded, ledger.results.get(effectId));
    }

    private CommandGateway commandGateway() {
        var gateway = mock(CommandGateway.class);
        when(gateway.send(any(), eq(Void.class))).thenReturn(CompletableFuture.completedFuture(null));
        return gateway;
    }

    private PaymentRequested requested() {
        return RequestPayment.event(new RequestPayment(
            "payment-247",
            "operation-283",
            "transaction-283",
            Payment.Method.CARD,
            new BigDecimal("42.50"),
            "BRL",
            "short-lived-token",
            "buyer@example.test",
            "visa",
            "correlation-283",
            "inventory-event-283"
        ), NOW);
    }

    private PaymentRefundRequested refundRequested() {
        return new PaymentRefundRequested(
            "payment-247", "operation-283", "transaction-283", "provider-283",
            "buyer-request", "correlation-283", "refund-request-283", NOW
        );
    }

    private PaymentProvider.Result approved() {
        return new PaymentProvider.Result("provider-283", Payment.Status.AUTHORIZED, null);
    }

    private static final class InMemoryLedger implements PaymentEffectLedger {
        private final Map<UUID, Effect> claims = new HashMap<>();
        private final Map<UUID, PaymentProvider.Result> results = new HashMap<>();

        @Override
        public boolean claim(Effect effect) {
            return claims.putIfAbsent(effect.effectId(), effect) == null;
        }

        @Override
        public Optional<PaymentProvider.Result> completed(UUID effectId) {
            return Optional.ofNullable(results.get(effectId));
        }

        @Override
        public void complete(UUID effectId, PaymentProvider.Result result, Instant completedAt) {
            if (!claims.containsKey(effectId)) throw new IllegalStateException("effect is not claimed");
            results.putIfAbsent(effectId, result);
        }
    }
}
