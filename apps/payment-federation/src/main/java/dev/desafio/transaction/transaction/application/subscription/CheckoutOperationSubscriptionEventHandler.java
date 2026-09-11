package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import org.axonframework.messaging.queryhandling.QueryUpdateEmitter;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;

public final class CheckoutOperationSubscriptionEventHandler {
    @EventHandler
    public void on(CheckoutOperationCommitted event, QueryUpdateEmitter emitter) {
        var view = event.view();
        if (view.owner() != null) {
            emitter.emit(CheckoutOperationUpdated.class, query -> query.matches(view), view);
        }
    }
}
