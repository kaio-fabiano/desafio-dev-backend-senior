package dev.desafio.transaction.transaction.application.query;

import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.domain.Transaction;

import java.math.BigDecimal;

public record TransactionView(
    String transactionId,
    String operationKey,
    String owner,
    String wooOrderId,
    BigDecimal amount,
    String currency,
    String paymentMethod,
    Transaction.Status status,
    String outcomeReference,
    int version
) {
    public static TransactionView from(TransactionEvent event) {
        return new TransactionView(
            event.transactionId(), event.operationKey(), event.owner(), event.wooOrderId(),
            event.amount(), event.currency(), event.paymentMethod(), event.status(), event.reference(), event.version()
        );
    }
}
