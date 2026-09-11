package dev.desafio.transaction.transaction.domain.event;

import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.eventsourcing.annotation.EventTag;
import org.axonframework.messaging.eventhandling.annotation.Event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Event(namespace = "transaction", name = "TransactionChanged", version = "1.0.0")
public record TransactionEvent(
    UUID eventId,
    @EventTag String transactionId,
    String operationKey,
    String owner,
    String wooOrderId,
    List<Transaction.Item> items,
    BigDecimal amount,
    String currency,
    String paymentMethod,
    String providerToken,
    String paymentMethodId,
    Transaction.Outcome outcome,
    String reference,
    Transaction.Status status,
    int version,
    Instant occurredAt
) {
    public static TransactionEvent outcome(
        String transactionId,
        String operationKey,
        String owner,
        String wooOrderId,
        List<Transaction.Item> items,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        String providerToken,
        String paymentMethodId,
        Transaction.Outcome outcome,
        String reference,
        Transaction.Status status,
        int version,
        Instant occurredAt
    ) {
        var eventId = UUID.nameUUIDFromBytes(
            (transactionId + "\u0000" + version + "\u0000" + status).getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
        return new TransactionEvent(
            eventId, transactionId, operationKey, owner, wooOrderId, List.copyOf(items), amount,
            currency, paymentMethod, providerToken, paymentMethodId,
            outcome, reference, status, version, occurredAt
        );
    }

    public static TransactionEvent from(Transaction.Event event) {
        return new TransactionEvent(
            event.eventId(), event.transactionId(), event.operationKey(), event.owner(), event.wooOrderId(),
            event.items(), event.amount(), event.currency(), event.paymentMethod(), event.providerToken(),
            event.paymentMethodId(), event.outcome(), event.reference(), event.status(), event.version(),
            event.occurredAt()
        );
    }

    public Transaction.Event toDomainEvent() {
        return new Transaction.Event(
            eventId, transactionId, operationKey, owner, wooOrderId, items, amount, currency,
            paymentMethod, providerToken, paymentMethodId, outcome, reference, status, version, occurredAt
        );
    }
}
