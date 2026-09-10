package dev.desafio.transaction.payment.domain;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
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
    String providerReference,
    String pixCode
) {
    public Payment {
        paymentId = requireText(paymentId, "paymentId");
        operationKey = requireText(operationKey, "operationKey");
        orderId = requireText(orderId, "orderId");
        Objects.requireNonNull(method, "method");
        Objects.requireNonNull(amount, "amount");
        if (amount.signum() <= 0) throw new IllegalArgumentException(PaymentErrorMessages.AMOUNT_MUST_BE_POSITIVE);
        currency = requireText(currency, "currency").toUpperCase(Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException(PaymentErrorMessages.CURRENCY_MUST_BE_ISO_4217);
        }
        Objects.requireNonNull(status, "status");
        providerReference = requireText(providerReference, "providerReference");
        if (method == Method.CARD && status == Status.PIX_GENERATED) {
            throw new IllegalArgumentException(PaymentErrorMessages.CARD_PAYMENTS_CANNOT_HAVE_PIX_STATUS);
        }
        if (method == Method.PIX && status == Status.AUTHORIZED) {
            throw new IllegalArgumentException(PaymentErrorMessages.PIX_PAYMENTS_CANNOT_HAVE_CARD_STATUS);
        }
        if ((status == Status.PIX_GENERATED) != hasText(pixCode)) {
            throw new IllegalArgumentException(PaymentErrorMessages.ONLY_GENERATED_PIX_PAYMENTS_HAVE_A_PIX_CODE);
        }
    }

    public static Payment fromProvider(PaymentRequested command, ProviderResult result) {
        Objects.requireNonNull(command, "command");
        Objects.requireNonNull(result, "result");
        if (result.status() == Status.REFUNDED
            || (command.method() == Method.CARD && result.status() == Status.PIX_GENERATED)
            || (command.method() == Method.PIX && result.status() == Status.AUTHORIZED)) {
            throw new IllegalArgumentException(PaymentErrorMessages.PROVIDER_RESULT_IS_INCOMPATIBLE_WITH_PAYMENT_REQUEST);
        }
        return new Payment(
            command.paymentId(),
            command.operationKey(),
            command.orderId(),
            command.method(),
            command.amount(),
            command.currency(),
            result.status(),
            result.providerReference(),
            result.pixCode()
        );
    }

    public Payment refund(RefundRequested command, ProviderResult result) {
        Objects.requireNonNull(command, "command");
        Objects.requireNonNull(result, "result");
        if (method != Method.CARD || (status != Status.AUTHORIZED && status != Status.REFUNDED)) {
            throw new IllegalStateException(PaymentErrorMessages.ONLY_AN_AUTHORIZED_CARD_PAYMENT_CAN_BE_REFUNDED);
        }
        if (!paymentId.equals(command.paymentId())
            || !operationKey.equals(command.operationKey())
            || !orderId.equals(command.orderId())) {
            throw new IllegalArgumentException(PaymentErrorMessages.REFUND_IDENTIFIERS_DO_NOT_MATCH_AUTHORIZED_PAYMENT);
        }
        if (!providerReference.equals(result.providerReference()) || result.status() != Status.REFUNDED) {
            throw new IllegalArgumentException(PaymentErrorMessages.REFUND_RESULT_DOES_NOT_MATCH_AUTHORIZED_PAYMENT);
        }
        return status == Status.REFUNDED
            ? this
            : new Payment(
                paymentId,
                operationKey,
                orderId,
                method,
                amount,
                currency,
                Status.REFUNDED,
                providerReference,
                null
            );
    }

    public boolean hasSameIdentity(Payment other) {
        return paymentId.equals(other.paymentId)
            && operationKey.equals(other.operationKey)
            && orderId.equals(other.orderId)
            && method == other.method
            && amount.compareTo(other.amount) == 0
            && currency.equals(other.currency)
            && providerReference.equals(other.providerReference);
    }

    public static OutgoingEvent resultEvent(Payment payment, Instant occurredAt) {
        return resultEvent(payment, payment.status, occurredAt);
    }

    public static OutgoingEvent resultEvent(Payment payment, Status resultStatus, Instant occurredAt) {
        Objects.requireNonNull(payment, "payment");
        Objects.requireNonNull(resultStatus, "resultStatus");
        Objects.requireNonNull(occurredAt, "occurredAt");
        if (resultStatus == Status.PENDING) return null;

        var eventType = switch (resultStatus) {
            case AUTHORIZED -> "payment.authorized";
            case PIX_GENERATED -> "payment.pix-generated";
            case REFUNDED -> "payment.refunded";
            case REJECTED -> "payment.failed";
            case PENDING -> throw new IllegalStateException(PaymentErrorMessages.PENDING_PAYMENTS_DO_NOT_EMIT_RESULT_EVENTS);
        };
        var payload = new LinkedHashMap<String, String>();
        payload.put("paymentId", payment.paymentId);
        if (resultStatus == Status.REJECTED) {
            payload.put("reason", "PROVIDER_REJECTED");
        } else {
            payload.put("orderId", payment.orderId);
            if (resultStatus == Status.AUTHORIZED || resultStatus == Status.PIX_GENERATED) {
                payload.put("providerReference", payment.providerReference);
            }
            if (resultStatus == Status.PIX_GENERATED) payload.put("pixCode", payment.pixCode);
        }
        return new OutgoingEvent(
            stableUuid(payment.operationKey, payment.paymentId, eventType),
            eventType,
            "v1",
            payment.operationKey,
            occurredAt,
            payload
        );
    }

    public static UUID stableUuid(String operationKey, String paymentId, String discriminator) {
        var material = operationKey.length() + ":" + operationKey
            + paymentId.length() + ":" + paymentId
            + discriminator.length() + ":" + discriminator;
        return UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8));
    }

    private static String requireText(String value, String name) {
        if (!hasText(value)) throw new IllegalArgumentException(PaymentErrorMessages.required(name));
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public enum Method { CARD, PIX }

    public enum Status { PENDING, AUTHORIZED, PIX_GENERATED, REFUNDED, REJECTED }

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
        String currency,
        String providerToken,
        String payerEmail,
        String paymentMethodId
    ) implements Command {
        public PaymentRequested {
            operationKey = requireText(operationKey, "operationKey");
            paymentId = requireText(paymentId, "paymentId");
            orderId = requireText(orderId, "orderId");
            Objects.requireNonNull(method, "method");
            Objects.requireNonNull(amount, "amount");
            currency = requireText(currency, "currency");
            payerEmail = requireText(payerEmail, "payerEmail");
            if (method == Method.CARD) {
                providerToken = requireText(providerToken, "providerToken");
                paymentMethodId = requireText(paymentMethodId, "paymentMethodId");
            } else if (hasText(providerToken) || hasText(paymentMethodId)) {
                throw new IllegalArgumentException(PaymentErrorMessages.PIX_PAYMENTS_DO_NOT_ACCEPT_CARD_PROVIDER_FIELDS);
            }
        }
    }

    public record RefundRequested(
        String operationKey,
        String paymentId,
        String orderId,
        String reason,
        String providerReference
    ) implements Command {
        public RefundRequested(String operationKey, String paymentId, String orderId, String reason) {
            this(operationKey, paymentId, orderId, reason, null);
        }

        public RefundRequested {
            operationKey = requireText(operationKey, "operationKey");
            paymentId = requireText(paymentId, "paymentId");
            orderId = requireText(orderId, "orderId");
            reason = requireText(reason, "reason");
        }

        public RefundRequested withProviderReference(String value) {
            return new RefundRequested(operationKey, paymentId, orderId, reason, requireText(value, "providerReference"));
        }
    }

    public record ProviderResult(String providerReference, Status status, String pixCode) {
        public ProviderResult {
            providerReference = requireText(providerReference, "providerReference");
            Objects.requireNonNull(status, "status");
            if ((status == Status.PIX_GENERATED) != hasText(pixCode)) {
                throw new IllegalArgumentException(PaymentErrorMessages.ONLY_GENERATED_PIX_RESULTS_HAVE_A_PIX_CODE);
            }
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
