package dev.desafio.transaction.transaction.application.command;

import dev.desafio.transaction.transaction.domain.Transaction;
import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import org.axonframework.messaging.commandhandling.annotation.Command;
import org.axonframework.modelling.annotation.TargetEntityId;

import java.math.BigDecimal;
import java.time.Instant;
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
    String paymentMethod,
    String providerToken,
    String paymentMethodId
) {
    public StartTransaction {
        transactionId = required(transactionId, "transactionId");
        operationKey = required(operationKey, "operationKey");
        owner = required(owner, "owner");
        wooOrderId = required(wooOrderId, "wooOrderId");
        items = List.copyOf(Objects.requireNonNull(items, "items"));
        Objects.requireNonNull(amount, "amount");
        currency = required(currency, "currency");
        paymentMethod = required(paymentMethod, "paymentMethod").toUpperCase(java.util.Locale.ROOT);
        if (paymentMethod.equals("CARD")) {
            providerToken = required(providerToken, "providerToken");
            paymentMethodId = required(paymentMethodId, "paymentMethodId");
        } else if (hasText(providerToken) || hasText(paymentMethodId)) {
            throw new IllegalArgumentException(TransactionErrorMessages.PIX_CARD_FIELDS_FORBIDDEN);
        }
    }

    public static TransactionEvent started(StartTransaction command, Instant occurredAt) {
        return TransactionEvent.from(Transaction.start(
            command.transactionId(), command.operationKey(), command.owner(), command.wooOrderId(),
            command.items(), command.amount(), command.currency(), command.paymentMethod(),
            command.providerToken(), command.paymentMethodId(), occurredAt
        ));
    }

    private static String required(String value, String name) {
        if (!hasText(value)) {
            throw new IllegalArgumentException(TransactionErrorMessages.required(name));
        }
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
