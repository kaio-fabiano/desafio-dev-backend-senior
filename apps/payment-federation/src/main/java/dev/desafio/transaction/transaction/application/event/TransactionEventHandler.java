package dev.desafio.transaction.transaction.application.event;

import dev.desafio.transaction.transaction.application.TransactionOutbox;
import dev.desafio.transaction.transaction.application.TransactionViewStore;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;

import java.util.Objects;

public final class TransactionEventHandler {
    private final TransactionViewStore views;
    private final TransactionOutbox outbox;

    public TransactionEventHandler(TransactionViewStore views, TransactionOutbox outbox) {
        this.views = Objects.requireNonNull(views, "views");
        this.outbox = Objects.requireNonNull(outbox, "outbox");
    }

    @EventHandler
    public void on(TransactionEvent event) {
        views.upsert(event);
        if (event.version() == 1) outbox.enqueueOrderReceived(event);
    }
}
