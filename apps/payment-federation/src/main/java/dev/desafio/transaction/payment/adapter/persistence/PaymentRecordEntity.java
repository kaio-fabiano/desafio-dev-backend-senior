package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.payment.domain.Payment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payment_record", schema = "payment")
public class PaymentRecordEntity implements Persistable<String> {
    @Id
    @Column(name = "payment_id", nullable = false)
    private String paymentId;

    @Column(name = "operation_key", nullable = false, unique = true)
    private String operationKey;

    @Column(name = "order_id")
    private String orderId;

    @Column(name = "transaction_id")
    private String transactionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Payment.Method method;

    @Column(nullable = false)
    private BigDecimal amount;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, columnDefinition = "char(3)")
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Payment.Status status;

    @Column(name = "provider_reference", nullable = false, unique = true)
    private String providerReference;

    @Column(name = "pix_code")
    private String pixCode;

    @Column(name = "event_sequence", nullable = false)
    private long eventSequence;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    @Transient
    private boolean newEntity = true;

    protected PaymentRecordEntity() {}

    private PaymentRecordEntity(
        String paymentId,
        String operationKey,
        String orderId,
        String transactionId,
        Payment.Method method,
        BigDecimal amount,
        String currency,
        Payment.Status status,
        String providerReference,
        String pixCode,
        long eventSequence
    ) {
        this.paymentId = paymentId;
        this.operationKey = operationKey;
        this.orderId = orderId;
        this.transactionId = transactionId;
        this.method = method;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.providerReference = providerReference;
        this.pixCode = pixCode;
        this.eventSequence = eventSequence;
    }

    public static PaymentRecordEntity from(Payment payment) {
        return new PaymentRecordEntity(
            payment.paymentId(), payment.operationKey(), payment.orderId(), null,
            payment.method(), payment.amount(), payment.currency(), payment.status(),
            payment.providerReference(), payment.pixCode(), 0
        );
    }

    public static PaymentRecordEntity projection(
        String paymentId,
        String operationKey,
        String transactionId,
        Payment.Method method,
        BigDecimal amount,
        String currency
    ) {
        return new PaymentRecordEntity(
            paymentId, operationKey, null, transactionId, method, amount, currency,
            Payment.Status.PENDING, "pending:" + operationKey, null, 1
        );
    }

    public Payment toDomain() {
        return new Payment(
            paymentId, operationKey, orderId, method, amount, currency, status,
            providerReference, pixCode
        );
    }

    public PaymentView toView() {
        return new PaymentView(
            paymentId, operationKey, orderId, method, amount, currency, status,
            providerReference, pixCode
        );
    }

    public void transition(Payment.Status nextStatus, String nextProviderReference, String nextPixCode) {
        status = nextStatus;
        providerReference = nextProviderReference;
        pixCode = nextPixCode;
        updatedAt = Instant.now();
    }

    public boolean project(
        Payment.Status nextStatus,
        String nextProviderReference,
        String nextPixCode,
        long nextSequence
    ) {
        if (eventSequence >= nextSequence) return false;
        transition(nextStatus, nextProviderReference, nextPixCode);
        eventSequence = nextSequence;
        return true;
    }

    public String paymentId() { return paymentId; }
    public String operationKey() { return operationKey; }
    public String orderId() { return orderId; }
    public Payment.Method method() { return method; }
    public Payment.Status status() { return status; }
    public String providerReference() { return providerReference; }

    @Override
    public String getId() { return paymentId; }

    @Override
    public boolean isNew() { return newEntity; }

    @PostLoad
    @PostPersist
    void markPersisted() { newEntity = false; }
}
