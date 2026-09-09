package dev.desafio.transaction.transaction.application;

import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.query.TransactionView;

import java.util.Optional;

public interface TransactionViewStore {
    void upsert(TransactionEvent event);
    Optional<TransactionView> find(String transactionId);
}
