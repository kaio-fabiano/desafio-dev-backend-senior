package dev.desafio.transaction.transaction.application.query;

import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Objects;

public final class FindOwnedTransactionHandler {
    private final TransactionReadRepository views;

    public FindOwnedTransactionHandler(TransactionReadRepository views) {
        this.views = Objects.requireNonNull(views, "views");
    }

    @QueryHandler
    public TransactionView handle(FindOwnedTransaction query) {
        return views.findTransaction(query.transactionId(), query.owner()).orElse(null);
    }
}
