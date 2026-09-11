package dev.desafio.transaction.payment.application.axon;

import dev.desafio.transaction.payment.adapter.axon.PaymentProviderEffectHandler;
import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.domain.event.PaymentRequested;
import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentProviderEffectHandlerTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

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
    @DisplayName("Ambiguous provider success is reconciled without repeating the effect @spec:AC-283")
    void ambiguousProviderSuccessIsReconciledWithoutRepeatingTheEffect() {
        var ledger = new InMemoryLedger();
        var executions = new AtomicInteger();
        var reconciliations = new AtomicInteger();
        var provider = new PaymentProvider() {
            @Override
            public Result execute(Payment.Command command) {
                executions.incrementAndGet();
                throw new IllegalStateException("timeout after provider success");
            }

            @Override
            public Result reconcile(Payment.Command command) {
                reconciliations.incrementAndGet();
                return approved();
            }
        };
        var handler = new PaymentProviderEffectHandler(ledger, provider, commandGateway(), CLOCK);
        var event = requested();

        assertThrows(IllegalStateException.class, () -> handler.execute(event));
        handler.execute(event).join();

        assertEquals(1, executions.get());
        assertEquals(1, reconciliations.get());
        assertEquals(1, ledger.results.size());
    }

    private CommandGateway commandGateway() {
        var gateway = mock(CommandGateway.class);
        when(gateway.send(any(), eq(Void.class))).thenReturn(CompletableFuture.completedFuture(null));
        return gateway;
    }

    private PaymentRequested requested() {
        return PaymentRequested.from(new RequestPayment(
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
