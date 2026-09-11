package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.application.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.application.checkout.WooCommerceOrderPort;
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

@Entity
@Table(name = "checkout_operation", schema = "transaction")
final class CheckoutOperationEntity {
    @Id
    @Column(name = "operation_id", nullable = false)
    private String operationId;

    @Column(name = "operation_key", nullable = false)
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

    @Column(name = "payment_id")
    private String paymentId;
    @Column(name = "error_reason")
    private String errorReason;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CheckoutOperationEntity() {}

    CheckoutOperationEntity(
        String operationId, String subject, String operationKey, String commandHash, String wooReference,
        Instant now
    ) {
        this.operationId = required(operationId, "operationId"); this.operationKey = required(operationKey, "operationKey"); this.subject = required(subject, "subject"); this.commandHash = required(commandHash, "commandHash"); this.wooReference = required(wooReference, "wooReference");
        this.status = CheckoutOperationRepository.Status.PENDING_WOO;
        this.paymentId = "payment:" + operationId;
        this.updatedAt = now;
    }

    void beginWooCreation(Instant now) {
        status = CheckoutOperationRepository.Status.WOO_CREATION_REQUESTED;
        updatedAt = now;
    }

    void recordWooOrder(WooCommerceOrderPort.Order order, Instant now) {
        if (status == CheckoutOperationRepository.Status.WOO_CONFIRMED || status == CheckoutOperationRepository.Status.COMPLETED) return;
        if (status != CheckoutOperationRepository.Status.WOO_CREATION_REQUESTED) {
            throw new IllegalStateException("Woo order cannot be recorded before creation is requested");
        }
        wooOrderId = order.id();
        items = List.copyOf(order.items());
        amount = order.amount();
        currency = order.currency();
        status = CheckoutOperationRepository.Status.WOO_CONFIRMED;
        updatedAt = now;
    }

    void complete(Instant now) {
        if (status == CheckoutOperationRepository.Status.COMPLETED) return;
        if (status != CheckoutOperationRepository.Status.WOO_CONFIRMED) {
            throw new IllegalStateException("Checkout cannot complete before WooCommerce confirmation");
        }
        status = CheckoutOperationRepository.Status.COMPLETED;
        updatedAt = now;
    }


    String operationId() { return operationId; }
    String operationKey() { return operationKey; }
    String subject() { return subject; }
    String commandHash() { return commandHash; }
    String wooReference() { return wooReference; }
    String wooOrderId() { return wooOrderId; }
    List<Transaction.Item> items() { return items == null ? List.of() : List.copyOf(items); }
    BigDecimal amount() { return amount; }
    String currency() { return currency; }
    CheckoutOperationRepository.Status status() { return status; }
    String paymentId() { return paymentId; }
    String errorReason() { return errorReason; }
    void fail(String reason, Instant now) {
        if (status == CheckoutOperationRepository.Status.COMPLETED || status == CheckoutOperationRepository.Status.FAILED) return;
        errorReason = required(reason, "errorReason"); status = CheckoutOperationRepository.Status.FAILED; updatedAt = now;
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
