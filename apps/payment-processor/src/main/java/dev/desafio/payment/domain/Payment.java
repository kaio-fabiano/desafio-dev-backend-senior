package dev.desafio.payment.domain;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public record Payment(
    String paymentId,
    String operationKey,
    String orderId,
    Method method,
    BigDecimal amount,
    String currency,
    Status status,
    String pixCode
) {
    public Payment {
        paymentId = requireText(paymentId, "paymentId");
        operationKey = requireText(operationKey, "operationKey");
        orderId = requireText(orderId, "orderId");
        Objects.requireNonNull(method, "method");
        Objects.requireNonNull(amount, "amount");
        if (amount.signum() <= 0) throw new IllegalArgumentException("amount must be positive");
        currency = requireText(currency, "currency").toUpperCase(Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("currency must be ISO-4217");
        Objects.requireNonNull(status, "status");
        if (method == Method.PIX && status != Status.PIX_GENERATED) {
            throw new IllegalArgumentException("Pix payments must remain PIX_GENERATED in this milestone");
        }
        if (method == Method.CARD && status == Status.PIX_GENERATED) {
            throw new IllegalArgumentException("Card payments cannot have Pix status");
        }
        if ((method == Method.PIX) != (pixCode != null && !pixCode.isBlank())) {
            throw new IllegalArgumentException("only Pix payments have a Pix code");
        }
    }

    public static Payment start(PaymentRequested command) {
        var status = command.method() == Method.CARD ? Status.AUTHORIZED : Status.PIX_GENERATED;
        var pixCode = command.method() == Method.PIX
            ? "PIX-" + stableUuid(command.operationKey(), command.paymentId(), "PIX_CODE")
            : null;
        return new Payment(
            command.paymentId(), command.operationKey(), command.orderId(), command.method(),
            command.amount(), command.currency(), status, pixCode
        );
    }

    public Payment refund(RefundRequested command) {
        if (method != Method.CARD || (status != Status.AUTHORIZED && status != Status.REFUNDED)) {
            throw new IllegalStateException("only an authorized Card payment can be refunded");
        }
        if (!paymentId.equals(command.paymentId())
            || !operationKey.equals(command.operationKey())
            || !orderId.equals(command.orderId())) {
            throw new IllegalArgumentException("refund identifiers do not match the authorized payment");
        }
        return status == Status.REFUNDED
            ? this
            : new Payment(paymentId, operationKey, orderId, method, amount, currency, Status.REFUNDED, null);
    }

    public boolean hasSameIdentity(Payment other) {
        return paymentId.equals(other.paymentId)
            && operationKey.equals(other.operationKey)
            && orderId.equals(other.orderId)
            && method == other.method
            && amount.compareTo(other.amount) == 0
            && currency.equals(other.currency)
            && Objects.equals(pixCode, other.pixCode);
    }

    public static OutgoingEvent resultEvent(Payment payment, Status resultStatus, Instant occurredAt) {
        Objects.requireNonNull(payment, "payment");
        Objects.requireNonNull(occurredAt, "occurredAt");
        var eventType = switch (resultStatus) {
            case AUTHORIZED -> "payment.authorized";
            case PIX_GENERATED -> "payment.pix-generated";
            case REFUNDED -> "payment.refunded";
        };
        Map<String, String> payload = resultStatus == Status.PIX_GENERATED
            ? Map.of("paymentId", payment.paymentId, "orderId", payment.orderId, "pixCode", payment.pixCode)
            : Map.of("paymentId", payment.paymentId, "orderId", payment.orderId);
        return new OutgoingEvent(
            stableUuid(payment.operationKey, payment.paymentId, eventType), eventType, "v1",
            payment.operationKey, occurredAt, payload
        );
    }

    private static UUID stableUuid(String operationKey, String paymentId, String discriminator) {
        return UUID.nameUUIDFromBytes(
            stableMaterial(operationKey, paymentId, discriminator).getBytes(StandardCharsets.UTF_8)
        );
    }

    private static String stableMaterial(String operationKey, String paymentId, String discriminator) {
        return operationKey.length() + ":" + operationKey
            + paymentId.length() + ":" + paymentId
            + discriminator.length() + ":" + discriminator;
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }

    public enum Method { CARD, PIX }

    public enum Status { AUTHORIZED, PIX_GENERATED, REFUNDED }

    public sealed interface Command permits PaymentRequested, RefundRequested {
        String operationKey();
        String paymentId();
        String orderId();
    }

    public record PaymentRequested(
        String operationKey,
        String paymentId,
        String orderId,
        Method method,
        BigDecimal amount,
        String currency
    ) implements Command {
        public PaymentRequested {
            operationKey = requireText(operationKey, "operationKey");
            paymentId = requireText(paymentId, "paymentId");
            orderId = requireText(orderId, "orderId");
            Objects.requireNonNull(method, "method");
            Objects.requireNonNull(amount, "amount");
            currency = requireText(currency, "currency");
        }
    }

    public record RefundRequested(
        String operationKey,
        String paymentId,
        String orderId,
        String reason
    ) implements Command {
        public RefundRequested {
            operationKey = requireText(operationKey, "operationKey");
            paymentId = requireText(paymentId, "paymentId");
            orderId = requireText(orderId, "orderId");
            reason = requireText(reason, "reason");
        }
    }

    public record OutgoingEvent(
        UUID eventId,
        String eventType,
        String eventVersion,
        String operationKey,
        Instant occurredAt,
        Map<String, String> payload
    ) {
        public OutgoingEvent {
            Objects.requireNonNull(eventId, "eventId");
            eventType = requireText(eventType, "eventType");
            eventVersion = requireText(eventVersion, "eventVersion");
            operationKey = requireText(operationKey, "operationKey");
            Objects.requireNonNull(occurredAt, "occurredAt");
            payload = Map.copyOf(payload);
        }
    }
}
