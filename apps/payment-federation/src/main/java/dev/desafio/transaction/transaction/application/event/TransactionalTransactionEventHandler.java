package dev.desafio.transaction.transaction.application.event;

import dev.desafio.transaction.transaction.application.TransactionOutbox;
import dev.desafio.transaction.transaction.application.TransactionViewStore;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.event.TransactionEventHandler;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;
import org.springframework.transaction.annotation.Transactional;

public class TransactionalTransactionEventHandler {
    private final TransactionEventHandler delegate;

    public TransactionalTransactionEventHandler(TransactionViewStore views, TransactionOutbox outbox) {
        delegate = new TransactionEventHandler(views, outbox);
    }

    @Transactional
    @EventHandler
    public void on(TransactionEvent event) {
        delegate.on(event);
    }
}
