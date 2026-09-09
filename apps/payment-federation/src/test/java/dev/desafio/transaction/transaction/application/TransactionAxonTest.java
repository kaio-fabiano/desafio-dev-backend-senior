package dev.desafio.transaction.transaction.application;

import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcome;
import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcomeHandler;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.application.command.StartTransactionHandler;
import dev.desafio.transaction.transaction.application.command.TransactionEventSourcedEntity;
import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.eventsourcing.configuration.EventSourcedEntityModule;
import org.axonframework.eventsourcing.configuration.EventSourcingConfigurer;
import org.axonframework.messaging.commandhandling.configuration.CommandHandlingModule;
import org.axonframework.test.fixture.AxonTestFixture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

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
                Transaction.Outcome.INVENTORY_RESERVED,
                "reservation-1",
                Transaction.Status.INVENTORY_RESERVED,
                2,
                NOW
            ));
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
            "CARD"
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
