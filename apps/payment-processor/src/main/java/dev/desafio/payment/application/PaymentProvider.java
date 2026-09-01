package dev.desafio.payment.application;

import dev.desafio.payment.domain.Payment;

import java.util.Objects;

/**
 * Outbound boundary for the real financial processor.
 *
 * Implementations must use {@link Payment.Command#operationKey()} as the
 * provider idempotency key. A repeated command must return the same result and
 * must never create a second charge, Pix payment, or refund.
 */
@FunctionalInterface
public interface PaymentProvider {
    Result execute(Payment.Command command);

    record Result(String providerReference) {
        public Result {
            if (providerReference == null || providerReference.isBlank()) {
                throw new IllegalArgumentException("providerReference is required");
            }
        }
    }

    static PaymentProvider deterministic() {
        return command -> new Result(
            "deterministic:" + Objects.requireNonNull(command, "command").operationKey()
        );
    }
}
