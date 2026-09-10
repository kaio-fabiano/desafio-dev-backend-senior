package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
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
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "checkout_operation", schema = "transaction")
final class CheckoutOperationEntity {
    @Id
    @Column(name = "transaction_id", nullable = false)
    private String transactionId;

    @Column(name = "operation_key", nullable = false, unique = true)
    private String operationKey;

    @Column(name = "subject", nullable = false)
    private String subject;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "command_hash", nullable = false, length = 64, columnDefinition = "char(64)")
    private String commandHash;

    @Column(name = "woo_reference", nullable = false, unique = true)
    private String wooReference;

    @Column(name = "woo_order_id", unique = true)
    private String wooOrderId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "items", columnDefinition = "jsonb")
    private List<Transaction.Item> items;

    @Column(name = "amount", precision = 19, scale = 6)
    private BigDecimal amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", length = 3, columnDefinition = "char(3)")
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CheckoutOperationRepository.Status status;

    @Column(name = "owner_token")
    private UUID ownerToken;

    @Column(name = "lease_until")
    private Instant leaseUntil;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CheckoutOperationEntity() {}

    CheckoutOperationEntity(
        String transactionId,
        CheckoutOperationRepository.ClaimRequest request,
        UUID ownerToken,
        Instant leaseUntil,
        Instant now
    ) {
        this.transactionId = required(transactionId, "transactionId");
        this.operationKey = request.operationKey();
        this.subject = request.subject();
        this.commandHash = request.commandHash();
        this.wooReference = request.wooReference();
        this.status = CheckoutOperationRepository.Status.PENDING_WOO;
        this.ownerToken = ownerToken;
        this.leaseUntil = leaseUntil;
        this.updatedAt = now;
    }

    void claim(UUID token, Instant until, Instant now) {
        ownerToken = token;
        leaseUntil = until;
        updatedAt = now;
    }

    void beginWooCreation(Instant now) {
        status = CheckoutOperationRepository.Status.CREATING_WOO;
        updatedAt = now;
    }

    void recordWooOrder(WooCommerceOrderPort.Order order, Instant now) {
        wooOrderId = order.id();
        items = List.copyOf(order.items());
        amount = order.amount();
        currency = order.currency();
        status = CheckoutOperationRepository.Status.WOO_CONFIRMED;
        updatedAt = now;
    }

    void complete(Instant now) {
        status = CheckoutOperationRepository.Status.COMPLETED;
        ownerToken = null;
        leaseUntil = null;
        updatedAt = now;
    }

    void release(Instant now) {
        ownerToken = null;
        leaseUntil = null;
        updatedAt = now;
    }

    String transactionId() { return transactionId; }
    String operationKey() { return operationKey; }
    String subject() { return subject; }
    String commandHash() { return commandHash; }
    String wooReference() { return wooReference; }
    String wooOrderId() { return wooOrderId; }
    List<Transaction.Item> items() { return items == null ? List.of() : List.copyOf(items); }
    BigDecimal amount() { return amount; }
    String currency() { return currency; }
    CheckoutOperationRepository.Status status() { return status; }
    UUID ownerToken() { return ownerToken; }
    Instant leaseUntil() { return leaseUntil; }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
