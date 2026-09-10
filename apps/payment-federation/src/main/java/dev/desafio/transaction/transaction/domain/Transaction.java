package dev.desafio.transaction.transaction.domain;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public final class Transaction {
    private String transactionId;
    private String operationKey;
    private String owner;
    private String wooOrderId;
    private List<Item> items;
    private BigDecimal amount;
    private String currency;
    private String paymentMethod;
    private Status status;
    private int version;

    private Transaction() {}

    public static Event start(
        String transactionId,
        String operationKey,
        String owner,
        String wooOrderId,
        List<Item> items,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        Instant occurredAt
    ) {
        return event(
            transactionId, operationKey, owner, wooOrderId, items, amount,
            currency, paymentMethod, null, null, Status.ACCEPTED, 1, occurredAt
        );
    }

    public static Transaction replay(List<Event> events) {
        if (events == null || events.isEmpty()) {
            throw new IllegalArgumentException(TransactionErrorMessages.TRANSACTION_EVENT_HISTORY_REQUIRED);
        }
        var transaction = new Transaction();
        events.forEach(transaction::apply);
        return transaction;
    }

    public Optional<Event> record(Outcome outcome, String reference, Instant occurredAt) {
        Objects.requireNonNull(outcome, "outcome");
        reference = required(reference, "reference");
        Objects.requireNonNull(occurredAt, "occurredAt");
        var next = nextStatus(status, outcome);
        if (next == null || next == status) return Optional.empty();
        return Optional.of(event(
            transactionId, operationKey, owner, wooOrderId, items, amount,
            currency, paymentMethod, outcome, reference, next, version + 1, occurredAt
        ));
    }

    public void apply(Event event) {
        Objects.requireNonNull(event, "event");
        if (version > 0 && !transactionId.equals(event.transactionId())) {
            throw new IllegalArgumentException(TransactionErrorMessages.EVENT_TRANSACTION_MISMATCH);
        }
        if (event.version() <= version) return;
        if (event.version() != version + 1) {
            throw new IllegalArgumentException(TransactionErrorMessages.EVENT_VERSION_NOT_CONTIGUOUS);
        }
        if (version > 0 && !matches(
            event.operationKey(), event.owner(), event.wooOrderId(), event.items(),
            event.amount(), event.currency(), event.paymentMethod()
        )) {
            throw new IllegalArgumentException(TransactionErrorMessages.TRANSACTION_FACTS_IMMUTABLE);
        }
        transactionId = event.transactionId();
        operationKey = event.operationKey();
        owner = event.owner();
        wooOrderId = event.wooOrderId();
        items = event.items();
        amount = event.amount();
        currency = event.currency();
        paymentMethod = event.paymentMethod();
        status = event.status();
        version = event.version();
    }

    public boolean matches(
        String expectedOperationKey,
        String expectedOwner,
        String expectedWooOrderId,
        List<Item> expectedItems,
        BigDecimal expectedAmount,
        String expectedCurrency,
        String expectedPaymentMethod
    ) {
        return operationKey.equals(expectedOperationKey)
            && owner.equals(expectedOwner)
            && wooOrderId.equals(expectedWooOrderId)
            && items.equals(expectedItems)
            && amount.compareTo(expectedAmount) == 0
            && currency.equals(expectedCurrency.toUpperCase(Locale.ROOT))
            && paymentMethod.equals(expectedPaymentMethod.toUpperCase(Locale.ROOT));
    }

    private static Status nextStatus(Status current, Outcome outcome) {
        return switch (current) {
            case ACCEPTED -> switch (outcome) {
                case INVENTORY_RESERVED -> Status.INVENTORY_RESERVED;
                case INVENTORY_REJECTED -> Status.REJECTED;
                default -> null;
            };
            case INVENTORY_RESERVED -> switch (outcome) {
                case PAYMENT_PENDING -> Status.PAYMENT_PENDING;
                case PAYMENT_APPROVED -> Status.PAYMENT_APPROVED;
                case PAYMENT_REJECTED -> Status.REJECTED;
                default -> null;
            };
            case PAYMENT_PENDING -> switch (outcome) {
                case PAYMENT_APPROVED -> Status.PAYMENT_APPROVED;
                case PAYMENT_REJECTED -> Status.REJECTED;
                default -> null;
            };
            case PAYMENT_APPROVED -> switch (outcome) {
                case INVENTORY_COMMITTED -> Status.COMPLETED;
                case INVENTORY_COMMIT_REJECTED -> Status.REFUND_PENDING;
                default -> null;
            };
            case REFUND_PENDING -> outcome == Outcome.PAYMENT_REFUNDED ? Status.REFUNDED : null;
            case COMPLETED, REJECTED, REFUNDED -> null;
        };
    }

    private static boolean isFuture(Status current, Outcome outcome) {
        return switch (current) {
            case ACCEPTED -> outcome != Outcome.INVENTORY_RESERVED
                && outcome != Outcome.INVENTORY_REJECTED;
            case INVENTORY_RESERVED, PAYMENT_PENDING -> outcome == Outcome.INVENTORY_COMMITTED
                || outcome == Outcome.INVENTORY_COMMIT_REJECTED
                || outcome == Outcome.PAYMENT_REFUNDED;
            case PAYMENT_APPROVED -> outcome == Outcome.PAYMENT_REFUNDED;
            case REFUND_PENDING, REFUNDED, COMPLETED, REJECTED -> false;
        };
    }

    private static Event event(
        String transactionId,
        String operationKey,
        String owner,
        String wooOrderId,
        List<Item> items,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        Outcome outcome,
        String reference,
        Status status,
        int version,
        Instant occurredAt
    ) {
        transactionId = required(transactionId, "transactionId");
        operationKey = required(operationKey, "operationKey");
        owner = required(owner, "owner");
        wooOrderId = required(wooOrderId, "wooOrderId");
        items = List.copyOf(Objects.requireNonNull(items, "items"));
        if (items.isEmpty()) throw new IllegalArgumentException(TransactionErrorMessages.ITEMS_REQUIRED);
        Objects.requireNonNull(amount, "amount");
        if (amount.signum() <= 0) throw new IllegalArgumentException(TransactionErrorMessages.AMOUNT_MUST_BE_POSITIVE);
        currency = required(currency, "currency").toUpperCase(Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException(TransactionErrorMessages.CURRENCY_MUST_BE_ISO_4217);
        }
        paymentMethod = required(paymentMethod, "paymentMethod").toUpperCase(Locale.ROOT);
        if (!paymentMethod.equals("CARD") && !paymentMethod.equals("PIX")) {
            throw new IllegalArgumentException(TransactionErrorMessages.PAYMENT_METHOD_INVALID);
        }
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(occurredAt, "occurredAt");
        var material = transactionId + "\u0000" + version + "\u0000" + status;
        return new Event(
            UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8)),
            transactionId, operationKey, owner, wooOrderId, items, amount,
            currency, paymentMethod, outcome, reference, status, version, occurredAt
        );
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(TransactionErrorMessages.required(name));
        }
        return value;
    }

    public String transactionId() { return transactionId; }
    public String operationKey() { return operationKey; }
    public String owner() { return owner; }
    public String wooOrderId() { return wooOrderId; }
    public List<Item> items() { return items; }
    public BigDecimal amount() { return amount; }
    public String currency() { return currency; }
    public String paymentMethod() { return paymentMethod; }
    public Status status() { return status; }
    public int version() { return version; }
    public boolean awaits(Outcome outcome) { return isFuture(status, outcome); }

    public enum Status {
        ACCEPTED,
        INVENTORY_RESERVED,
        PAYMENT_PENDING,
        PAYMENT_APPROVED,
        REFUND_PENDING,
        REFUNDED,
        COMPLETED,
        REJECTED
    }

    public enum Outcome {
        INVENTORY_RESERVED,
        INVENTORY_REJECTED,
        PAYMENT_PENDING,
        PAYMENT_APPROVED,
        PAYMENT_REJECTED,
        INVENTORY_COMMITTED,
        INVENTORY_COMMIT_REJECTED,
        PAYMENT_REFUNDED
    }

    public static final class OutcomeNotReadyException extends RuntimeException {
        public OutcomeNotReadyException(Status status, Outcome outcome) {
            super(TransactionErrorMessages.outcomeNotReady(outcome, status));
        }
    }

    public record Item(String productId, int quantity) {
        public Item {
            productId = required(productId, "productId");
            if (quantity < 1) {
                throw new IllegalArgumentException(TransactionErrorMessages.QUANTITY_MUST_BE_POSITIVE);
            }
        }
    }

    public record Event(
        UUID eventId,
        String transactionId,
        String operationKey,
        String owner,
        String wooOrderId,
        List<Item> items,
        BigDecimal amount,
        String currency,
        String paymentMethod,
        Outcome outcome,
        String reference,
        Status status,
        int version,
        Instant occurredAt
    ) {
        public Event {
            Objects.requireNonNull(eventId, "eventId");
            transactionId = required(transactionId, "transactionId");
            operationKey = required(operationKey, "operationKey");
            owner = required(owner, "owner");
            wooOrderId = required(wooOrderId, "wooOrderId");
            items = List.copyOf(items);
            Objects.requireNonNull(amount, "amount");
            currency = required(currency, "currency");
            paymentMethod = required(paymentMethod, "paymentMethod");
            Objects.requireNonNull(status, "status");
            if ((version == 1) != (outcome == null && reference == null)) {
                throw new IllegalArgumentException(TransactionErrorMessages.INITIAL_EVENT_OUTCOME_INVALID);
            }
            if (version > 1 && (outcome == null || reference == null || reference.isBlank())) {
                throw new IllegalArgumentException(TransactionErrorMessages.OUTCOME_METADATA_REQUIRED);
            }
            if (version < 1) throw new IllegalArgumentException(TransactionErrorMessages.VERSION_MUST_BE_POSITIVE);
            Objects.requireNonNull(occurredAt, "occurredAt");
        }
    }
}
