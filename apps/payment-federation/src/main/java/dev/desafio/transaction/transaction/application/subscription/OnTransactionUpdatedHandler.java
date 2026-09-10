package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import org.axonframework.messaging.queryhandling.annotation.QueryHandler;
import reactor.core.publisher.Flux;

import java.util.Optional;

public final class OnTransactionUpdatedHandler {
    private final TransactionSubscriptionGateway subscriptions;
    private final Optional<TransactionReadRepository> views;

    public OnTransactionUpdatedHandler(
        TransactionSubscriptionGateway subscriptions,
        Optional<TransactionReadRepository> views
    ) {
        this.subscriptions = subscriptions;
        this.views = views;
    }

    @QueryHandler
    public Optional<TransactionView> initialResult(OnTransactionUpdated query) {
        if (query.transactionId() == null) return Optional.empty();
        return views.flatMap(repository -> repository.findTransaction(query.transactionId(), query.owner()));
    }

    public Flux<TransactionView> subscribe(String transactionId, String owner) {
        return stream(new OnTransactionUpdated(transactionId, owner));
    }

    public Flux<TransactionView> subscribeByOperationKey(String operationKey, String owner) {
        return stream(OnTransactionUpdated.byOperationKey(operationKey, owner));
    }

    private Flux<TransactionView> stream(OnTransactionUpdated query) {
        return subscriptions.subscribe(query)
            .distinctUntilChanged(TransactionView::version, (previous, current) -> current <= previous);
    }
}
