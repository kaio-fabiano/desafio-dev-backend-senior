package dev.desafio.transaction.transaction.application.checkout;

import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;

public final class CheckoutIdempotencyConflictException extends RuntimeException {
    public CheckoutIdempotencyConflictException() {
        super(TransactionErrorMessages.CHECKOUT_IDEMPOTENCY_CONFLICT);
    }
}
