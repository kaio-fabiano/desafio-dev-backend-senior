package dev.desafio.transaction.transaction.checkout;

import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;

public final class CheckoutBusyException extends RuntimeException {
    public CheckoutBusyException() {
        super(TransactionErrorMessages.CHECKOUT_BUSY);
    }
}
