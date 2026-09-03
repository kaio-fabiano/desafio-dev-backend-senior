package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProviderNotificationHandlerTest {
    private static final Instant RECEIVED_AT = Instant.parse("2026-09-02T12:00:00Z");

    @Test
    @DisplayName("AC-163: duplicate provider request ids are claimed once @spec:AC-163")
    void reportsDuplicateProviderRequestIds() {
        var calls = new AtomicInteger();
        ProviderNotificationHandler.Repository repository = (requestId, state, receivedAt) ->
            calls.getAndIncrement() == 0
                ? ProviderNotificationHandler.Outcome.APPLIED
                : ProviderNotificationHandler.Outcome.DUPLICATE;
        var handler = handler(providerReturning("42"), repository);
        var notification = new ProviderNotificationHandler.Notification("request-1", "42");

        assertEquals(ProviderNotificationHandler.Outcome.APPLIED, handler.handle(notification));
        assertEquals(ProviderNotificationHandler.Outcome.DUPLICATE, handler.handle(notification));
    }

    @Test
    @DisplayName("AC-164: authoritative provider state is correlated before transition @spec:AC-164")
    void persistsOnlyTheCorrelatedAuthoritativeState() {
        var applied = new AtomicInteger();
        ProviderNotificationHandler.Repository repository = (requestId, state, receivedAt) -> {
            assertEquals("request-1", requestId);
            assertEquals("42", state.providerReference());
            assertEquals(Payment.Status.AUTHORIZED, state.status());
            assertEquals(RECEIVED_AT, receivedAt);
            applied.incrementAndGet();
            return ProviderNotificationHandler.Outcome.APPLIED;
        };
        var handler = handler(providerReturning("42"), repository);

        assertEquals(
            ProviderNotificationHandler.Outcome.APPLIED,
            handler.handle(new ProviderNotificationHandler.Notification("request-1", "42"))
        );
        assertEquals(1, applied.get());
    }

    @Test
    void rejectsAProviderResponseForAnotherPayment() {
        var applied = new AtomicInteger();
        var handler = handler(
            providerReturning("different-reference"),
            (requestId, state, receivedAt) -> {
                applied.incrementAndGet();
                return ProviderNotificationHandler.Outcome.APPLIED;
            }
        );

        assertThrows(
            IllegalStateException.class,
            () -> handler.handle(new ProviderNotificationHandler.Notification("request-1", "42"))
        );
        assertEquals(0, applied.get());
    }

    private ProviderNotificationHandler handler(
        PaymentProvider provider,
        ProviderNotificationHandler.Repository repository
    ) {
        return new ProviderNotificationHandler(
            provider,
            repository,
            Clock.fixed(RECEIVED_AT, ZoneOffset.UTC)
        );
    }

    private PaymentProvider.Result approved(String reference) {
        return new PaymentProvider.Result(reference, Payment.Status.AUTHORIZED, null);
    }

    private PaymentProvider providerReturning(String reference) {
        return new PaymentProvider() {
            @Override
            public Result execute(Payment.Command command) {
                throw new UnsupportedOperationException("not used by notification tests");
            }

            @Override
            public Result findByProviderReference(String ignored) {
                return approved(reference);
            }
        };
    }
}
