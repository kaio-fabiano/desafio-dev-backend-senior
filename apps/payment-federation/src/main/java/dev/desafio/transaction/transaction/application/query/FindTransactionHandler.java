package dev.desafio.transaction.transaction.application.query;

import dev.desafio.transaction.transaction.application.TransactionViewStore;
import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Objects;
import java.util.Optional;

public final class FindTransactionHandler {
    private final TransactionViewStore views;

    public FindTransactionHandler(TransactionViewStore views) {
        this.views = Objects.requireNonNull(views, "views");
    }

    @QueryHandler
    public Optional<TransactionView> handle(FindTransaction query) {
        return views.find(query.transactionId());
    }
}
