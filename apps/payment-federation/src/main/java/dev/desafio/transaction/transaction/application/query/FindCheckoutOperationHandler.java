package dev.desafio.transaction.transaction.application.query;

import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Objects;

public final class FindCheckoutOperationHandler {
    private final TransactionReadRepository views;

    public FindCheckoutOperationHandler(TransactionReadRepository views) {
        this.views = Objects.requireNonNull(views, "views");
    }

    @QueryHandler
    public CheckoutOperationView handle(FindCheckoutOperation query) {
        return views.findCheckout(query.id(), query.owner()).orElse(null);
    }
}
