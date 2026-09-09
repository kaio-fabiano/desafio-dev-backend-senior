package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.TransactionView;
import reactor.core.publisher.Flux;

public interface TransactionSubscriptionGateway {
    Flux<TransactionView> subscribe(OnTransactionUpdated query);
}
