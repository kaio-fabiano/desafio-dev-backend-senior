package dev.desafio.transaction.transaction.checkout;

public final class CheckoutBusyException extends RuntimeException {
    public CheckoutBusyException() {
        super("Checkout creation did not complete before the bounded wait expired");
    }
}
