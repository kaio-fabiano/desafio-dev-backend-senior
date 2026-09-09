package dev.desafio.transaction.transaction.application;

import dev.desafio.transaction.transaction.application.event.TransactionEvent;

@FunctionalInterface
public interface TransactionOutbox {
    void enqueueOrderReceived(TransactionEvent event);
}
