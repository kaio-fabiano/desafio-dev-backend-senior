package dev.desafio.transaction.transaction.application.command;

import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Command(namespace = "transaction", name = "StartTransaction", version = "1.0.0")
public record StartTransaction(
    @TargetEntityId String transactionId,
    String operationKey,
    String owner,
    String wooOrderId,
    List<Transaction.Item> items,
    BigDecimal amount,
    String currency,
    String paymentMethod
) {
    public StartTransaction {
        transactionId = required(transactionId, "transactionId");
        operationKey = required(operationKey, "operationKey");
        owner = required(owner, "owner");
        wooOrderId = required(wooOrderId, "wooOrderId");
        items = List.copyOf(Objects.requireNonNull(items, "items"));
        Objects.requireNonNull(amount, "amount");
        currency = required(currency, "currency");
        paymentMethod = required(paymentMethod, "paymentMethod");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
