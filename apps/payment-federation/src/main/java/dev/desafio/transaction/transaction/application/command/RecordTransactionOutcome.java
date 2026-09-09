package dev.desafio.transaction.transaction.application.command;

import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.util.Objects;

@Command(namespace = "transaction", name = "RecordTransactionOutcome", version = "1.0.0")
public record RecordTransactionOutcome(
    @TargetEntityId String transactionId,
    Transaction.Outcome outcome,
    String reference
) {
    public RecordTransactionOutcome {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("transactionId is required");
        }
        Objects.requireNonNull(outcome, "outcome");
        if (reference == null || reference.isBlank()) throw new IllegalArgumentException("reference is required");
    }
}
