package dev.desafio.transaction.payment.adapter.provider;

import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.domain.Payment;

import java.util.Objects;

public final class DeterministicPaymentProvider implements PaymentProvider {
    @Override
    public Result execute(Payment.Command command) {
        Objects.requireNonNull(command, "command");
        var reference = command instanceof Payment.RefundRequested refund
            ? requireReference(refund.providerReference())
            : "deterministic:" + command.operationKey();
        if (command instanceof Payment.PaymentRequested requested) {
            return requested.method() == Payment.Method.CARD
                ? new Result(reference, Payment.Status.AUTHORIZED, null)
                : new Result(reference, Payment.Status.PIX_GENERATED, "PIX:" + reference);
        }
        return new Result(reference, Payment.Status.REFUNDED, null);
    }

    private static String requireReference(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("providerReference is required");
        }
        return value;
    }
}
