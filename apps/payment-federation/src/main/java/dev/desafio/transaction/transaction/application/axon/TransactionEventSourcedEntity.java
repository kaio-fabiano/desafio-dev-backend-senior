package dev.desafio.transaction.transaction.application.axon;

import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcome;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.eventsourcing.annotation.EventSourcingHandler;
import org.axonframework.eventsourcing.annotation.reflection.EntityCreator;
import org.axonframework.extension.spring.stereotype.EventSourced;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@EventSourced(tagKey = "transactionId", idType = String.class)
public final class TransactionEventSourcedEntity {
    private Transaction transaction;

    @EntityCreator
    public TransactionEventSourcedEntity(TransactionEvent firstEvent) {
        transaction = Transaction.replay(List.of(firstEvent.toDomainEvent()));
    }

    public boolean matches(StartTransaction command) {
        return transaction.matches(
            command.operationKey(), command.owner(), command.wooOrderId(), command.items(),
            command.amount(), command.currency(), command.paymentMethod(),
            command.providerToken(), command.paymentMethodId(), command.payerEmail()
        );
    }

    public Optional<TransactionEvent> record(RecordTransactionOutcome command, Instant occurredAt) {
        return transaction.record(command.outcome(), command.reference(), occurredAt)
            .map(TransactionEvent::from);
    }

    public boolean awaits(RecordTransactionOutcome command) {
        return transaction.awaits(command.outcome());
    }

    public Transaction.Status status() {
        return transaction.status();
    }

    @EventSourcingHandler
    public void on(TransactionEvent event) {
        transaction.apply(event.toDomainEvent());
    }
}
