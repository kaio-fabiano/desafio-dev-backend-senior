package dev.desafio.transaction.transaction.application;

import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.event.TransactionEventHandler;
import dev.desafio.transaction.transaction.application.query.FindTransaction;
import dev.desafio.transaction.transaction.application.query.FindTransactionHandler;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TransactionProjectionTest {
    @Test
    @DisplayName("Domain event projection and query use paths distinct from aggregate loading @spec:AC-281")
    void domainEventProjectionAndQueryUsePathsDistinctFromAggregateLoading() {
        var writes = new AtomicInteger();
        var outboxWrites = new AtomicInteger();
        var event = StartTransaction.started(new StartTransaction(
            "transaction-1", "operation-1", "buyer-1", "woo-42",
            List.of(new Transaction.Item("1001", 1)),
            new BigDecimal("19.90"), "BRL", "PIX", null, null
        ), Instant.parse("2026-09-09T12:00:00Z"));
        TransactionView expected = TransactionView.from(event);
        TransactionViewStore views = new TransactionViewStore() {
            @Override public void upsert(TransactionEvent ignored) { writes.incrementAndGet(); }
            @Override public Optional<TransactionView> find(String id) { return Optional.of(expected); }
        };
        TransactionOutbox outbox = ignored -> outboxWrites.incrementAndGet();

        new TransactionEventHandler(views, outbox).on(event);
        var result = new FindTransactionHandler(views).handle(new FindTransaction("transaction-1"));

        assertEquals(Optional.of(expected), result);
        assertEquals(1, writes.get());
        assertEquals(1, outboxWrites.get());
    }

    @Test
    @DisplayName("OrderReceived is mapped once to the Transaction AMQP outbox without credentials @spec:AC-293")
    void orderReceivedIsMappedOnceToTheTransactionAmqpOutboxWithoutCredentials() {
        var outboxWrites = new AtomicInteger();
        var event = StartTransaction.started(new StartTransaction(
            "transaction-1", "operation-1", "buyer-1", "woo-42",
            List.of(new Transaction.Item("1001", 1)),
            new BigDecimal("19.90"), "BRL", "CARD", "provider-token", "visa"
        ), Instant.parse("2026-09-09T12:00:00Z"));
        TransactionViewStore views = new TransactionViewStore() {
            @Override public void upsert(TransactionEvent ignored) {}
            @Override public Optional<TransactionView> find(String id) { return Optional.empty(); }
        };
        var handler = new TransactionEventHandler(views, ignored -> outboxWrites.incrementAndGet());

        handler.on(event);
        handler.on(TransactionEvent.outcome(
            "transaction-1", "operation-1", "buyer-1", "woo-42",
            List.of(new Transaction.Item("1001", 1)), new BigDecimal("19.90"), "BRL", "CARD",
            "provider-token", "visa",
            Transaction.Outcome.INVENTORY_RESERVED, "reservation-1",
            Transaction.Status.INVENTORY_RESERVED, 2, event.occurredAt().plusSeconds(1)
        ));

        assertEquals(1, outboxWrites.get());
    }
}
