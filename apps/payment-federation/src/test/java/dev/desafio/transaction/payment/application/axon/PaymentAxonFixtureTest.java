package dev.desafio.transaction.payment.application.axon;

import dev.desafio.transaction.payment.adapter.axon.PaymentCommandHandler;
import dev.desafio.transaction.payment.application.command.RecordPaymentOutcome;
import dev.desafio.transaction.payment.application.command.RecordProviderNotification;
import dev.desafio.transaction.payment.application.command.RefundPayment;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.application.event.PaymentApproved;
import dev.desafio.transaction.payment.application.event.PaymentPending;
import dev.desafio.transaction.payment.application.event.PaymentRefundRequested;
import dev.desafio.transaction.payment.application.event.PaymentRefunded;
import dev.desafio.transaction.payment.application.event.PaymentRequested;
import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.eventsourcing.configuration.EventSourcedEntityModule;
import org.axonframework.eventsourcing.configuration.EventSourcingConfigurer;
import org.axonframework.messaging.commandhandling.configuration.CommandHandlingModule;
import org.axonframework.test.fixture.AxonTestFixture;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentAxonFixtureTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    @DisplayName("Payment replay rebuilds state without provider effects @spec:AC-282")
    void paymentReplayRebuildsStateWithoutProviderEffects() {
        var fixture = fixture();
        try {
            var request = request("card", Payment.Method.CARD);
            var requested = PaymentRequested.from(request, NOW);

            fixture.given()
                .event(requested)
                .when()
                .command(new RecordPaymentOutcome(
                    request.paymentId(), "provider-card", Payment.Status.AUTHORIZED, null,
                    request.correlationId(), "effect-card"
                ))
                .then()
                .success()
                .events(new PaymentApproved(
                    request.paymentId(), request.transactionId(), "provider-card",
                    request.correlationId(), "effect-card", NOW
                ));
        } finally {
            fixture.stop();
        }
    }

    @Test
    @DisplayName("Card, Pix, refund, duplicate, and conflicting intents preserve Payment invariants @spec:AC-283")
    void cardPixRefundDuplicateAndConflictingIntentsPreservePaymentInvariants() {
        var fixture = fixture();
        try {
            var card = request("card", Payment.Method.CARD);
            var cardRequested = PaymentRequested.from(card, NOW);

            fixture.given()
                .noPriorActivity()
                .when()
                .command(card)
                .then()
                .success()
                .resultMessagePayload(card.paymentId())
                .events(cardRequested);

            fixture.given()
                .event(cardRequested)
                .when()
                .command(card)
                .then()
                .success()
                .noEvents();

            var conflicting = new RequestPayment(
                card.paymentId(), "another-operation", card.transactionId(), Payment.Method.CARD,
                card.amount(), card.currency(), card.providerToken(), card.payerEmail(),
                card.paymentMethodId(), card.correlationId(), card.causationId()
            );
            fixture.given()
                .event(cardRequested)
                .when()
                .command(conflicting)
                .then()
                .noEvents()
                .exceptionSatisfies(error -> assertTrue(hasCause(error, IllegalArgumentException.class)));

            fixture.given()
                .event(cardRequested)
                .when()
                .command(new RefundPayment(
                    card.paymentId(), card.operationKey(), card.transactionId(), "buyer-request",
                    card.correlationId(), "refund-before-approval"
                ))
                .then()
                .noEvents()
                .exceptionSatisfies(error -> assertTrue(hasCause(error, IllegalStateException.class)));

            var pix = request("pix", Payment.Method.PIX);
            var pixRequested = PaymentRequested.from(pix, NOW);
            fixture.given()
                .event(pixRequested)
                .when()
                .command(new RecordPaymentOutcome(
                    pix.paymentId(), "provider-pix", Payment.Status.PIX_GENERATED, "PIX-CODE",
                    pix.correlationId(), "effect-pix"
                ))
                .then()
                .success()
                .events(new PaymentPending(
                    pix.paymentId(), pix.transactionId(), "provider-pix", "PIX-CODE",
                    pix.correlationId(), "effect-pix", NOW
                ));

            var approved = new PaymentApproved(
                card.paymentId(), card.transactionId(), "provider-card",
                card.correlationId(), "effect-card", NOW
            );
            var refund = new RefundPayment(
                card.paymentId(), card.operationKey(), card.transactionId(), "buyer-request",
                card.correlationId(), "refund-request"
            );
            var refundRequested = new PaymentRefundRequested(
                card.paymentId(), card.operationKey(), card.transactionId(), "provider-card",
                "buyer-request", card.correlationId(), "refund-request", NOW
            );
            fixture.given()
                .event(cardRequested)
                .event(approved)
                .when()
                .command(refund)
                .then()
                .success()
                .events(refundRequested);

            fixture.given()
                .event(cardRequested)
                .event(approved)
                .event(refundRequested)
                .when()
                .command(new RecordPaymentOutcome(
                    card.paymentId(), "provider-card", Payment.Status.REFUNDED, null,
                    card.correlationId(), "effect-refund"
                ))
                .then()
                .success()
                .events(new PaymentRefunded(
                    card.paymentId(), card.transactionId(), "provider-card",
                    card.correlationId(), "effect-refund", NOW
                ));
        } finally {
            fixture.stop();
        }
    }

    @Test
    @DisplayName("Duplicate provider webhooks converge through an Axon command @spec:AC-283")
    void duplicateProviderWebhooksConvergeThroughAnAxonCommand() {
        var fixture = fixture();
        try {
            var request = request("webhook", Payment.Method.CARD);
            var requested = PaymentRequested.from(request, NOW);
            var pending = new PaymentPending(
                request.paymentId(), request.transactionId(), "provider-webhook", null,
                request.correlationId(), "effect-webhook", NOW
            );
            var notification = new RecordProviderNotification(
                request.paymentId(), "provider-request-283", "provider-webhook",
                Payment.Status.AUTHORIZED, null
            );

            fixture.given()
                .events(requested, pending)
                .when()
                .command(notification)
                .then()
                .success()
                .events(new PaymentApproved(
                    request.paymentId(), request.transactionId(), "provider-webhook",
                    "provider-request-283", "provider-request-283", NOW
                ));

            fixture.given()
                .events(requested, pending, new PaymentApproved(
                    request.paymentId(), request.transactionId(), "provider-webhook",
                    "provider-request-283", "provider-request-283", NOW
                ))
                .when()
                .command(notification)
                .then()
                .success()
                .noEvents();
        } finally {
            fixture.stop();
        }
    }

    private AxonTestFixture fixture() {
        var configurer = EventSourcingConfigurer.create()
            .registerEntity(EventSourcedEntityModule.autodetected(String.class, PaymentAggregate.class))
            .registerCommandHandlingModule(
                CommandHandlingModule.named("payment")
                    .commandHandlers()
                    .autodetectedCommandHandlingComponent(config -> new PaymentCommandHandler(CLOCK))
            );
        return AxonTestFixture.with(configurer);
    }

    private RequestPayment request(String suffix, Payment.Method method) {
        return new RequestPayment(
            "payment-" + suffix,
            "operation-" + suffix,
            "transaction-" + suffix,
            method,
            new BigDecimal("42.50"),
            "BRL",
            method == Payment.Method.CARD ? "short-lived-token" : null,
            "buyer@example.test",
            method == Payment.Method.CARD ? "visa" : null,
            "correlation-" + suffix,
            "inventory-event-" + suffix
        );
    }

    private boolean hasCause(Throwable thrown, Class<? extends Throwable> type) {
        for (var current = thrown; current != null && current.getCause() != current;
             current = current.getCause()) {
            if (type.isInstance(current)) return true;
        }
        return false;
    }
}
