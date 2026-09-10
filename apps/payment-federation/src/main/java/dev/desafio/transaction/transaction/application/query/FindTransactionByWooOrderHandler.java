package dev.desafio.transaction.transaction.application.query;

import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Objects;

public final class FindTransactionByWooOrderHandler {
    private final TransactionReadRepository views;

    public FindTransactionByWooOrderHandler(TransactionReadRepository views) {
        this.views = Objects.requireNonNull(views, "views");
    }

    @QueryHandler
    public TransactionView handle(FindTransactionByWooOrder query) {
        return views.findTransactionByWooOrder(query.wooOrderId(), query.owner()).orElse(null);
    }
}
