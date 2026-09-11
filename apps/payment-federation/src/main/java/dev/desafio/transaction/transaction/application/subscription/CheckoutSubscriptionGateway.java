package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import reactor.core.publisher.Flux;

public interface CheckoutSubscriptionGateway {
    Flux<CheckoutOperationView> subscribe(CheckoutOperationUpdated query);
}
