package dev.desafio.transaction.transaction.interfaces.graphql;

import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.domain.Transaction;

import java.time.Instant;

public record OrderEventView(
    String operationKey,
    String orderId,
    String state,
    String pixCode,
    String eventTime,
    int version
) {
    static OrderEventView from(TransactionView transaction) {
        return new OrderEventView(
            transaction.operationKey(),
            transaction.wooOrderId(),
            switch (transaction.status()) {
                case ACCEPTED -> "CREATED";
                case INVENTORY_RESERVED -> "PAYMENT_PENDING";
                case PAYMENT_PENDING -> transaction.paymentMethod().equals("PIX")
                    ? "PIX_GENERATED" : "PAYMENT_PENDING";
                case PAYMENT_APPROVED -> "STOCK_PENDING";
                case REFUND_PENDING -> "REFUND_PENDING";
                case REFUNDED -> "REFUNDED";
                case COMPLETED -> "COMPLETED";
                case REJECTED -> "CANCELLED";
            },
            transaction.status() == Transaction.Status.PAYMENT_PENDING
                && transaction.paymentMethod().equals("PIX") ? transaction.outcomeReference() : null,
            Instant.now().toString(),
            transaction.version()
        );
    }
}
