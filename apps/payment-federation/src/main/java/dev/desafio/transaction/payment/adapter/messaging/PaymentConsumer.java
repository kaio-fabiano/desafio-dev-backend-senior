package dev.desafio.transaction.payment.adapter.messaging;

import dev.desafio.transaction.payment.application.PaymentHandler;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.payment.application.command.AuthorizePayment;
import dev.desafio.transaction.payment.domain.Payment;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

public final class PaymentConsumer {
    private final PaymentHandler handler;

    public PaymentConsumer(PaymentHandler handler) {
        this.handler = Objects.requireNonNull(handler, "handler");
    }

    public PaymentRepository.ProcessingResult consume(
        Delivery delivery,
        Acknowledgement acknowledgement
    ) {
        Objects.requireNonNull(delivery, "delivery");
        Objects.requireNonNull(acknowledgement, "acknowledgement");

        Payment.Command command = switch (delivery.eventType()) {
            case "payment.requested" -> new AuthorizePayment(
                delivery.operationKey(),
                delivery.paymentId(),
                delivery.orderId(),
                Payment.Method.valueOf(required(delivery.method(), "method")),
                Objects.requireNonNull(delivery.amount(), "amount"),
                required(delivery.currency(), "currency"),
                delivery.providerToken(),
                delivery.payerEmail(),
                delivery.paymentMethodId()
            ).toDomainCommand();
            case "payment.refund-requested" -> new Payment.RefundRequested(
                delivery.operationKey(),
                delivery.paymentId(),
                delivery.orderId(),
                required(delivery.reason(), "reason")
            );
            default -> throw new IllegalArgumentException(
                "unsupported payment event: " + delivery.eventType()
            );
        };

        var result = handler.handle(delivery.eventId(), command);
        acknowledgement.acknowledge();
        return result;
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
        return value;
    }

    @FunctionalInterface
    public interface Acknowledgement {
        void acknowledge();
    }

    public record Delivery(
        UUID eventId,
        String eventType,
        String operationKey,
        String paymentId,
        String orderId,
        String method,
        BigDecimal amount,
        String currency,
        String providerToken,
        String payerEmail,
        String paymentMethodId,
        String reason
    ) {
        public Delivery {
            Objects.requireNonNull(eventId, "eventId");
            eventType = required(eventType, "eventType");
            operationKey = required(operationKey, "operationKey");
            paymentId = required(paymentId, "paymentId");
            orderId = required(orderId, "orderId");
        }

        public static Delivery paymentRequested(
            UUID eventId,
            String operationKey,
            String paymentId,
            String orderId,
            Payment.Method method,
            BigDecimal amount,
            String currency,
            String providerToken,
            String payerEmail,
            String paymentMethodId
        ) {
            return new Delivery(
                eventId,
                "payment.requested",
                operationKey,
                paymentId,
                orderId,
                method.name(),
                amount,
                currency,
                providerToken,
                payerEmail,
                paymentMethodId,
                null
            );
        }

        public static Delivery refundRequested(
            UUID eventId,
            String operationKey,
            String paymentId,
            String orderId,
            String reason
        ) {
            return new Delivery(
                eventId,
                "payment.refund-requested",
                operationKey,
                paymentId,
                orderId,
                null,
                null,
                null,
                null,
                null,
                null,
                reason
            );
        }
    }
}
