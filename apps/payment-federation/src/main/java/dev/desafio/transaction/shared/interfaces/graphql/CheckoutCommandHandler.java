package dev.desafio.transaction.shared.interfaces.graphql;

import dev.desafio.transaction.transaction.checkout.CheckoutCommand;
import dev.desafio.transaction.transaction.checkout.CheckoutResult;
import dev.desafio.transaction.transaction.checkout.CheckoutService;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;

import java.util.Optional;

public final class CheckoutCommandHandler {
    private final Optional<CheckoutService> checkout;

    public CheckoutCommandHandler(Optional<CheckoutService> checkout) {
        this.checkout = checkout;
    }

    @CommandHandler
    public CheckoutResult handle(CheckoutCommand command) {
        return checkout.orElseThrow(
            () -> new IllegalStateException(GraphQlErrorMessages.CHECKOUT_WRITES_UNAVAILABLE)
        )
            .checkout(command);
    }
}
