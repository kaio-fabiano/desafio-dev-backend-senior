package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import reactor.core.publisher.Flux;

import java.util.Optional;

public final class CheckoutOperationUpdatedHandler {
    private final CheckoutSubscriptionGateway subscriptions;
    private final TransactionReadRepository views;

    public CheckoutOperationUpdatedHandler(CheckoutSubscriptionGateway subscriptions, TransactionReadRepository views) {
        this.subscriptions = subscriptions;
        this.views = views;
    }

    public Optional<CheckoutOperationView> initialResult(CheckoutOperationUpdated query) {
        return views.findCheckout(query.operationId(), query.owner());
    }

    public Flux<CheckoutOperationView> subscribe(String operationId, String owner) {
        return subscriptions.subscribe(new CheckoutOperationUpdated(operationId, owner))
            .distinctUntilChanged(CheckoutOperationView::status);
    }
}
