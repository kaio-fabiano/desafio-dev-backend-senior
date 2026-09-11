package dev.desafio.transaction.transaction.application.command;

import dev.desafio.transaction.transaction.application.checkout.CheckoutResult;
import dev.desafio.transaction.transaction.application.checkout.CheckoutService;
import org.axonframework.messaging.commandhandling.annotation.CommandHandler;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public final class CheckoutCommandHandler {
    private final Optional<CheckoutService> checkout;

    public CheckoutCommandHandler(Optional<CheckoutService> checkout) {
        this.checkout = checkout;
    }

    @CommandHandler
    public CheckoutResult handle(CheckoutCommand command) {
        return checkout.orElseThrow(
            () -> new IllegalStateException("Checkout writes are unavailable")
        )
            .checkout(command);
    }
}
