package dev.desafio.transaction.transaction.application;

import dev.desafio.transaction.transaction.domain.event.TransactionEvent;

public interface TransactionOutbox {
    void enqueueOrderReceived(TransactionEvent event);

    void enqueueCancelled(TransactionEvent event);
}
