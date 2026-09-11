package dev.desafio.transaction.transaction.interfaces.graphql;

import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.application.subscription.OnTransactionUpdatedHandler;
import dev.desafio.transaction.transaction.application.subscription.CheckoutOperationUpdatedHandler;
import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.SubscriptionMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import reactor.core.publisher.Flux;

import java.security.Principal;

@Controller
public class TransactionSubscriptionController {
    private final OnTransactionUpdatedHandler subscriptions;
    private final CheckoutOperationUpdatedHandler checkoutSubscriptions;

    public TransactionSubscriptionController(OnTransactionUpdatedHandler subscriptions, CheckoutOperationUpdatedHandler checkoutSubscriptions) {
        this.subscriptions = subscriptions;
        this.checkoutSubscriptions = checkoutSubscriptions;
    }

    @SubscriptionMapping
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public Flux<TransactionView> onTransactionUpdated(
        @Argument String transactionId,
        Principal principal
    ) {
        return subscriptions.subscribe(transactionId, principal.getName());
    }

    @SubscriptionMapping
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public Flux<OrderEventView> orderEvents(
        @Argument String operationKey,
        Principal principal
    ) {
        return subscriptions.subscribeByOperationKey(operationKey, principal.getName())
            .map(OrderEventView::from);
    }

    @SubscriptionMapping
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public Flux<CheckoutOperationView> checkoutUpdated(@Argument String operationId, Principal principal) {
        return checkoutSubscriptions.subscribe(operationId, principal.getName());
    }
}
