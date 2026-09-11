package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import org.axonframework.messaging.core.annotation.Namespace;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;
import org.axonframework.messaging.queryhandling.QueryUpdateEmitter;

@Namespace("dev.desafio.transaction.transaction.application.event")
public final class TransactionSubscriptionEventHandler {
    @EventHandler
    public void on(TransactionEvent event, QueryUpdateEmitter emitter) {
        var view = TransactionView.from(event);
        emitter.emit(OnTransactionUpdated.class, query -> query.matches(view), view);
    }
}
