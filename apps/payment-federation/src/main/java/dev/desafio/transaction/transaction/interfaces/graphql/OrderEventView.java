package dev.desafio.transaction.transaction.interfaces.graphql;

import dev.desafio.transaction.transaction.application.query.TransactionView;

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
                case INVENTORY_RESERVED, PAYMENT_PENDING -> "PAYMENT_PENDING";
                case PAYMENT_APPROVED -> "STOCK_PENDING";
                case REFUND_PENDING -> "REFUND_PENDING";
                case REFUNDED -> "REFUNDED";
                case COMPLETED -> "COMPLETED";
                case REJECTED -> "CANCELLED";
            },
            null,
            Instant.now().toString(),
            transaction.version()
        );
    }
}
