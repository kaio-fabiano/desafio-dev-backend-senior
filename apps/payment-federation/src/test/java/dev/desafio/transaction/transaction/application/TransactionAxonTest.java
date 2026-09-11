package dev.desafio.transaction.transaction.application;

import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcome;
import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcomeHandler;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.application.command.StartTransactionHandler;
import dev.desafio.transaction.transaction.application.command.TransactionEventSourcedEntity;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.eventsourcing.configuration.EventSourcedEntityModule;
import org.axonframework.eventsourcing.configuration.EventSourcingConfigurer;
import org.axonframework.messaging.commandhandling.configuration.CommandHandlingModule;
import org.axonframework.messaging.commandhandling.CommandMessage;
import org.axonframework.messaging.commandhandling.GenericCommandMessage;
import org.axonframework.messaging.commandhandling.interception.CommandSequencingInterceptor;
import org.axonframework.messaging.core.MessageStream;
import org.axonframework.messaging.core.MessageType;
import org.axonframework.messaging.core.unitofwork.ProcessingContext;
import org.axonframework.test.fixture.AxonTestFixture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TransactionAxonTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private AxonTestFixture fixture;

    @AfterEach
    void stopFixture() {
        if (fixture != null) fixture.stop();
    }

    @Test
    @DisplayName("Axon command appends a tagged event and event sourcing recreates Transaction @spec:AC-281 @spec:AC-282")
    void axonCommandAppendsATaggedEventAndEventSourcingRecreatesTransaction() {
        fixture = fixture("start-transaction", config -> new StartTransactionHandler(CLOCK));
        var command = startCommand();

        fixture.given()
            .noPriorActivity()
            .when()
            .command(command)
            .then()
            .success()
            .resultMessagePayload("transaction-1")
            .events(TransactionEvent.started(command, NOW));
    }

    @Test
    @DisplayName("Repeated StartTransaction returns the same stream without another event @spec:AC-285")
    void repeatedStartTransactionReturnsTheSameStreamWithoutAnotherEvent() {
        fixture = fixture("start-transaction-retry", config -> new StartTransactionHandler(CLOCK));
        var command = startCommand();

        fixture.given()
            .event(TransactionEvent.started(command, NOW))
            .when()
            .command(command)
            .then()
            .success()
            .resultMessagePayload("transaction-1")
            .noEvents();
    }

    @Test
    @DisplayName("One checkout creates at most one internal Transaction @spec:AC-339")
    void oneCheckoutCreatesAtMostOneInternalTransaction() {
        fixture = fixture("single-transaction-per-checkout", config -> new StartTransactionHandler(CLOCK));
        var command = startCommand();

        fixture.given()
            .event(TransactionEvent.started(command, NOW))
            .when()
            .command(command)
            .then()
            .success()
            .noEvents();
    }

    @Test
    @DisplayName("Axon outcome command emits only a Transaction-owned fact after InventoryReserved @spec:AC-286")
    void axonOutcomeCommandEmitsOnlyATransactionOwnedFactAfterInventoryReserved() {
        fixture = fixture("record-transaction-outcome", config -> new RecordTransactionOutcomeHandler(CLOCK));
        var started = TransactionEvent.started(startCommand(), NOW);

        fixture.given()
            .event(started)
            .when()
            .command(new RecordTransactionOutcome(
                "transaction-1",
                Transaction.Outcome.INVENTORY_RESERVED,
                "reservation-1"
            ))
            .then()
            .success()
            .events(TransactionEvent.outcome(
                "transaction-1",
                "operation-1",
                "buyer-1",
                "woo-42",
                List.of(new Transaction.Item("1001", 2)),
                new BigDecimal("19.90"),
                "BRL",
                "CARD",
                "provider-token",
                "visa",
                Transaction.Outcome.INVENTORY_RESERVED,
                "reservation-1",
                Transaction.Status.INVENTORY_RESERVED,
                2,
                NOW
            ));
    }

    @Test
    @DisplayName("Same checkout routing key never overlaps locally @spec:AC-336")
    void sameCheckoutRoutingKeyNeverOverlapsLocally() throws Exception {
        var interceptor = new dev.desafio.transaction.transaction.configuration.TransactionConfiguration()
            .commandSequencingInterceptor();
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var active = new AtomicInteger();
        var maximum = new AtomicInteger();
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> first = executor.submit(() -> invoke(interceptor, "operation-1", entered, release, active, maximum));
            assertTrue(entered.await(1, TimeUnit.SECONDS));
            Future<?> second = executor.submit(() -> invoke(interceptor, "operation-1", new CountDownLatch(1), new CountDownLatch(0), active, maximum));
            assertFalse(second.isDone());
            release.countDown();
            first.get(1, TimeUnit.SECONDS);
            second.get(1, TimeUnit.SECONDS);
        }
        assertEquals(1, maximum.get());
    }

    @Test
    @DisplayName("Different checkout routing keys may overlap locally @spec:AC-336")
    void differentCheckoutRoutingKeysMayOverlapLocally() throws Exception {
        var interceptor = new dev.desafio.transaction.transaction.configuration.TransactionConfiguration()
            .commandSequencingInterceptor();
        var entered = new CountDownLatch(2);
        var release = new CountDownLatch(1);
        var active = new AtomicInteger();
        var maximum = new AtomicInteger();
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> first = executor.submit(() -> invoke(interceptor, "operation-1", entered, release, active, maximum));
            Future<?> second = executor.submit(() -> invoke(interceptor, "operation-2", entered, release, active, maximum));
            assertTrue(entered.await(1, TimeUnit.SECONDS));
            assertTrue(maximum.get() >= 2);
            release.countDown();
            first.get(1, TimeUnit.SECONDS);
            second.get(1, TimeUnit.SECONDS);
        }
    }

    private void invoke(CommandSequencingInterceptor<CommandMessage> interceptor,
                         String routingKey,
                         CountDownLatch entered,
                         CountDownLatch release,
                         AtomicInteger active,
                         AtomicInteger maximum) {
        var context = org.mockito.Mockito.mock(ProcessingContext.class);
        var completion = new java.util.concurrent.atomic.AtomicReference<Consumer<ProcessingContext>>();
        org.mockito.Mockito.when(context.doFinally(org.mockito.Mockito.any()))
            .thenAnswer(invocation -> {
                completion.set(invocation.getArgument(0));
                return context;
            });
        var command = new GenericCommandMessage(new MessageType("checkout"), "payload",
            Map.of(), routingKey, null);
        interceptor.interceptOnHandle(command, context, (message, ignored) -> {
            int current = active.incrementAndGet();
            maximum.accumulateAndGet(current, Math::max);
            entered.countDown();
            try {
                release.await(1, TimeUnit.SECONDS);
                return MessageStream.empty();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new AssertionError(exception);
            } finally {
                active.decrementAndGet();
                completion.get().accept(context);
            }
        }).first();
    }

    private StartTransaction startCommand() {
        return new StartTransaction(
            "transaction-1",
            "operation-1",
            "buyer-1",
            "woo-42",
            List.of(new Transaction.Item("1001", 2)),
            new BigDecimal("19.90"),
            "BRL",
            "CARD",
            "provider-token",
            "visa"
        );
    }

    private AxonTestFixture fixture(
        String name,
        org.axonframework.common.configuration.ComponentBuilder<Object> handler
    ) {
        var configurer = EventSourcingConfigurer.create()
            .registerEntity(EventSourcedEntityModule.autodetected(
                String.class,
                TransactionEventSourcedEntity.class
            ))
            .registerCommandHandlingModule(
                CommandHandlingModule.named(name)
                    .commandHandlers()
                    .autodetectedCommandHandlingComponent(handler)
            );
        return AxonTestFixture.with(configurer);
    }
}
