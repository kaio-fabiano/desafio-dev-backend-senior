package dev.desafio.transaction.transaction.checkout;

public final class CheckoutIdempotencyConflictException extends RuntimeException {
    public CheckoutIdempotencyConflictException() {
        super("The operation key is already bound to a different checkout command");
    }
}
