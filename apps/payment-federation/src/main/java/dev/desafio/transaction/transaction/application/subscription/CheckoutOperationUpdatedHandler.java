package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import reactor.core.publisher.Flux;
import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Optional;

public final class CheckoutOperationUpdatedHandler {
    private final CheckoutSubscriptionGateway subscriptions;
    private final Optional<TransactionReadRepository> views;

    public CheckoutOperationUpdatedHandler(CheckoutSubscriptionGateway subscriptions, TransactionReadRepository views) {
        this.subscriptions = subscriptions;
        this.views = Optional.of(views);
    }

    public CheckoutOperationUpdatedHandler(CheckoutSubscriptionGateway subscriptions, Optional<TransactionReadRepository> views) {
        this.subscriptions = subscriptions;
        this.views = views;
    }

    @QueryHandler
    public Optional<CheckoutOperationView> initialResult(CheckoutOperationUpdated query) {
        return views.flatMap(repository -> repository.findCheckout(query.operationId(), query.owner()));
    }

    public Flux<CheckoutOperationView> subscribe(String operationId, String owner) {
        return subscriptions.subscribe(new CheckoutOperationUpdated(operationId, owner))
            .distinctUntilChanged(view -> view, (previous, current) ->
                statusRank(current.status()) <= statusRank(previous.status()));
    }

    private static int statusRank(String status) {
        return switch (status) {
            case "PROCESSING" -> 0;
            case "COMPLETED", "FAILED" -> 1;
            default -> throw new IllegalArgumentException("Unsupported checkout status");
        };
    }
}
