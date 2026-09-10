package dev.desafio.transaction.payment.application.axon;

import dev.desafio.transaction.payment.application.command.RecordPaymentOutcome;
import dev.desafio.transaction.payment.application.command.RefundPayment;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.application.event.PaymentApproved;
import dev.desafio.transaction.payment.application.event.PaymentPending;
import dev.desafio.transaction.payment.application.event.PaymentRefundRequested;
import dev.desafio.transaction.payment.application.event.PaymentRefunded;
import dev.desafio.transaction.payment.application.event.PaymentRejected;
import dev.desafio.transaction.payment.application.event.PaymentRequested;
import dev.desafio.transaction.payment.domain.Payment;
import org.axonframework.eventsourcing.annotation.EventSourcingHandler;
import org.axonframework.eventsourcing.annotation.reflection.EntityCreator;
import org.axonframework.extension.spring.stereotype.EventSourced;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@EventSourced(tagKey = PaymentAggregate.TAG_KEY, idType = String.class)
public final class PaymentAggregate {
    public static final String TAG_KEY = "paymentId";

    private String paymentId;
    private String operationKey;
    private String transactionId;
    private Payment.Method method;
    private BigDecimal amount;
    private String currency;
    private Stage stage;
    private String providerReference;
    private String pixCode;

    @EntityCreator
    public PaymentAggregate(PaymentRequested event) {
        this.paymentId = event.paymentId();
        this.operationKey = event.operationKey();
        this.transactionId = event.transactionId();
        this.method = event.method();
        this.amount = event.amount();
        this.currency = event.currency();
        this.stage = Stage.REQUESTED;
    }

    public static PaymentRequested request(RequestPayment command, Instant now) {
        Objects.requireNonNull(command, "command");
        Objects.requireNonNull(now, "now");
        return PaymentRequested.from(command, now);
    }

    public void assertSameIntent(RequestPayment command) {
        if (!paymentId.equals(command.paymentId())
            || !operationKey.equals(command.operationKey())
            || !transactionId.equals(command.transactionId())
            || method != command.method()
            || amount.compareTo(command.amount()) != 0
            || !currency.equals(command.currency())) {
            throw new IllegalArgumentException("payment identifiers identify a conflicting intent");
        }
    }

    public Object record(RecordPaymentOutcome command, Instant now) {
        Objects.requireNonNull(command, "command");
        Objects.requireNonNull(now, "now");
        if (!paymentId.equals(command.paymentId())) throw new IllegalArgumentException("paymentId does not match");
        if (isSameOutcome(command)) return null;
        if (stage == Stage.APPROVED || stage == Stage.REJECTED || stage == Stage.REFUNDED) {
            throw new IllegalStateException("terminal payment state cannot change");
        }
        if (stage == Stage.REFUND_PENDING) {
            if (command.status() != Payment.Status.REFUNDED
                || !providerReference.equals(command.providerReference())) {
                throw new IllegalStateException("refund must preserve the approved provider reference");
            }
            return new PaymentRefunded(
                paymentId, transactionId, providerReference,
                command.correlationId(), command.causationId(), now
            );
        }
        if (command.status() == Payment.Status.REFUNDED) {
            throw new IllegalStateException("refund requires an approved payment");
        }
        if (method == Payment.Method.CARD && command.status() == Payment.Status.PIX_GENERATED) {
            throw new IllegalArgumentException("Card payments cannot have Pix status");
        }
        if (method == Payment.Method.PIX && command.status() == Payment.Status.AUTHORIZED) {
            throw new IllegalArgumentException("Pix payments cannot have Card status");
        }
        return switch (command.status()) {
            case PENDING, PIX_GENERATED -> new PaymentPending(
                paymentId, transactionId, command.providerReference(), command.pixCode(),
                command.correlationId(), command.causationId(), now
            );
            case AUTHORIZED -> new PaymentApproved(
                paymentId, transactionId, command.providerReference(),
                command.correlationId(), command.causationId(), now
            );
            case REJECTED -> new PaymentRejected(
                paymentId, transactionId, command.providerReference(), "PROVIDER_REJECTED",
                command.correlationId(), command.causationId(), now
            );
            case REFUNDED -> throw new IllegalStateException("refund requires an approved payment");
        };
    }

    public PaymentRefundRequested refund(RefundPayment command, Instant now) {
        Objects.requireNonNull(command, "command");
        Objects.requireNonNull(now, "now");
        if (!paymentId.equals(command.paymentId())
            || !operationKey.equals(command.operationKey())
            || !transactionId.equals(command.transactionId())) {
            throw new IllegalArgumentException("refund identifiers do not match the payment");
        }
        if (stage == Stage.REFUND_PENDING || stage == Stage.REFUNDED) return null;
        if (method != Payment.Method.CARD || stage != Stage.APPROVED) {
            throw new IllegalStateException("refund requires an approved Card payment");
        }
        return new PaymentRefundRequested(
            paymentId, operationKey, transactionId, providerReference, command.reason(),
            command.correlationId(), command.causationId(), now
        );
    }

    @EventSourcingHandler
    public void on(PaymentPending event) {
        providerReference = event.providerReference();
        pixCode = event.pixCode();
        stage = Stage.PENDING;
    }

    @EventSourcingHandler
    public void on(PaymentApproved event) {
        providerReference = event.providerReference();
        pixCode = null;
        stage = Stage.APPROVED;
    }

    @EventSourcingHandler
    public void on(PaymentRejected event) {
        providerReference = event.providerReference();
        pixCode = null;
        stage = Stage.REJECTED;
    }

    @EventSourcingHandler
    public void on(PaymentRefundRequested event) {
        stage = Stage.REFUND_PENDING;
    }

    @EventSourcingHandler
    public void on(PaymentRefunded event) {
        stage = Stage.REFUNDED;
    }

    public Stage stage() {
        return stage;
    }

    public String providerReference() {
        return providerReference;
    }

    public String pixCode() {
        return pixCode;
    }

    private boolean isSameOutcome(RecordPaymentOutcome command) {
        if (!Objects.equals(providerReference, command.providerReference())) return false;
        return switch (stage) {
            case PENDING -> command.status() == Payment.Status.PENDING
                || command.status() == Payment.Status.PIX_GENERATED;
            case APPROVED -> command.status() == Payment.Status.AUTHORIZED;
            case REJECTED -> command.status() == Payment.Status.REJECTED;
            case REFUNDED -> command.status() == Payment.Status.REFUNDED;
            default -> false;
        };
    }

    public enum Stage { REQUESTED, PENDING, APPROVED, REJECTED, REFUND_PENDING, REFUNDED }
}
