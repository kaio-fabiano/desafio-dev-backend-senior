package dev.desafio.transaction.transaction.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TransactionTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");

    @Test
    @DisplayName("Transaction replay restores durable state without side effects @spec:AC-282")
    void transactionReplayRestoresDurableStateWithoutSideEffects() {
        var started = Transaction.start(
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
            NOW
        );
        var transaction = Transaction.replay(List.of(started));
        var reserved = transaction.record(
            Transaction.Outcome.INVENTORY_RESERVED,
            "reservation-1",
            NOW.plusSeconds(1)
        ).orElseThrow();
        transaction.apply(reserved);
        var approved = transaction.record(
            Transaction.Outcome.PAYMENT_APPROVED,
            "payment-1",
            NOW.plusSeconds(2)
        ).orElseThrow();
        transaction.apply(approved);
        var committed = transaction.record(
            Transaction.Outcome.INVENTORY_COMMITTED,
            "reservation-1",
            NOW.plusSeconds(3)
        ).orElseThrow();

        var replayed = Transaction.replay(List.of(started, reserved, approved, committed));

        assertEquals(Transaction.Status.COMPLETED, replayed.status());
        assertEquals(4, replayed.version());
        assertEquals("buyer-1", replayed.owner());
        assertEquals("woo-42", replayed.wooOrderId());
    }

    @Test
    @DisplayName("Transaction records only local outcome facts and ignores stale delivery @spec:AC-286")
    void transactionRecordsOnlyLocalOutcomeFactsAndIgnoresStaleDelivery() {
        var started = Transaction.start(
            "transaction-1", "operation-1", "buyer-1", "woo-42",
            List.of(new Transaction.Item("1001", 1)),
            new BigDecimal("19.90"), "BRL", "PIX", null, null, NOW
        );
        var transaction = Transaction.replay(List.of(started));

        assertTrue(transaction.record(
            Transaction.Outcome.PAYMENT_APPROVED,
            "payment-too-early",
            NOW.plusSeconds(1)
        ).isEmpty());
        assertEquals(Transaction.Status.ACCEPTED, transaction.status());

        var reserved = transaction.record(
            Transaction.Outcome.INVENTORY_RESERVED,
            "reservation-1",
            NOW.plusSeconds(2)
        ).orElseThrow();
        transaction.apply(reserved);

        assertTrue(transaction.record(
            Transaction.Outcome.INVENTORY_RESERVED,
            "reservation-duplicate",
            NOW.plusSeconds(3)
        ).isEmpty());
        assertEquals(Transaction.Status.INVENTORY_RESERVED, transaction.status());
        assertEquals(2, transaction.version());
    }
}
