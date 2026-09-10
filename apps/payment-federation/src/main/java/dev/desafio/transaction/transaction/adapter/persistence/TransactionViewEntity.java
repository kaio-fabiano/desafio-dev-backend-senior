package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.domain.Transaction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "transaction_view", schema = "transaction")
final class TransactionViewEntity {
    @Id
    @Column(name = "transaction_id", nullable = false)
    private String transactionId;

    @Column(name = "operation_key", nullable = false, unique = true)
    private String operationKey;

    @Column(name = "owner_subject", nullable = false)
    private String ownerSubject;

    @Column(name = "woo_order_id", nullable = false, unique = true)
    private String wooOrderId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 6)
    private BigDecimal amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3, columnDefinition = "char(3)")
    private String currency;

    @Column(name = "payment_method", nullable = false)
    private String paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Transaction.Status status;

    @Column(name = "outcome_reference")
    private String outcomeReference;

    @Column(name = "version", nullable = false)
    private int eventVersion;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TransactionViewEntity() {}

    TransactionViewEntity(TransactionEvent event) {
        transactionId = required(event.transactionId(), "transactionId");
        operationKey = required(event.operationKey(), "operationKey");
        ownerSubject = required(event.owner(), "owner");
        wooOrderId = required(event.wooOrderId(), "wooOrderId");
        amount = event.amount();
        currency = required(event.currency(), "currency");
        paymentMethod = required(event.paymentMethod(), "paymentMethod");
        apply(event);
    }

    boolean apply(TransactionEvent event) {
        if (event.version() <= eventVersion) return false;
        if (!transactionId.equals(event.transactionId())
            || !operationKey.equals(event.operationKey())
            || !ownerSubject.equals(event.owner())
            || !wooOrderId.equals(event.wooOrderId())
            || amount.compareTo(event.amount()) != 0
            || !currency.equals(event.currency())
            || !paymentMethod.equals(event.paymentMethod())) {
            throw new IllegalArgumentException("transaction projection identity and checkout facts are immutable");
        }
        status = event.status();
        outcomeReference = event.reference();
        eventVersion = event.version();
        updatedAt = event.occurredAt();
        return true;
    }

    String transactionId() { return transactionId; }
    String operationKey() { return operationKey; }
    String ownerSubject() { return ownerSubject; }
    String wooOrderId() { return wooOrderId; }
    BigDecimal amount() { return amount; }
    String currency() { return currency; }
    String paymentMethod() { return paymentMethod; }
    Transaction.Status status() { return status; }
    String outcomeReference() { return outcomeReference; }
    int eventVersion() { return eventVersion; }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
