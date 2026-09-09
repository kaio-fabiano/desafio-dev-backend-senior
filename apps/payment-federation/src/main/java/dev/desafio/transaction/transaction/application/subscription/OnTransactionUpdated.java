package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.TransactionView;
import org.axonframework.messaging.queryhandling.annotation.Query;

@Query(namespace = "transaction", name = "OnTransactionUpdated", version = "1.0.0")
public record OnTransactionUpdated(String transactionId, String operationKey, String owner) {
    public OnTransactionUpdated(String transactionId, String owner) {
        this(required(transactionId, "transactionId"), null, owner);
    }

    public OnTransactionUpdated {
        owner = required(owner, "owner");
        if ((transactionId == null) == (operationKey == null)) {
            throw new IllegalArgumentException("exactly one transaction selector is required");
        }
    }

    public static OnTransactionUpdated byOperationKey(String operationKey, String owner) {
        return new OnTransactionUpdated(null, required(operationKey, "operationKey"), owner);
    }

    public boolean matches(TransactionView view) {
        return owner.equals(view.owner())
            && (transactionId != null
                ? transactionId.equals(view.transactionId())
                : operationKey.equals(view.operationKey()));
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
