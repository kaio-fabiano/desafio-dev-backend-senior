package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

@Command(namespace = "payment", name = "RefundPayment", version = "1.0.0")
public record RefundPayment(
    @TargetEntityId String paymentId,
    String operationKey,
    String transactionId,
    String reason,
    String correlationId,
    String causationId
) {
    public RefundPayment {
        paymentId = required(paymentId, "paymentId");
        operationKey = required(operationKey, "operationKey");
        transactionId = required(transactionId, "transactionId");
        reason = required(reason, "reason");
        correlationId = required(correlationId, "correlationId");
        causationId = required(causationId, "causationId");
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(PaymentErrorMessages.required(field));
        return value;
    }
}
