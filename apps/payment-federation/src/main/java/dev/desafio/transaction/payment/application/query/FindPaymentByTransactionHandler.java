package dev.desafio.transaction.payment.application.query;

import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Objects;

public final class FindPaymentByTransactionHandler {
    private final PaymentViewRepository views;

    public FindPaymentByTransactionHandler(PaymentViewRepository views) {
        this.views = Objects.requireNonNull(views, "views");
    }

    @QueryHandler
    public PaymentView handle(FindPaymentByTransaction query) {
        return views.findByTransactionId(query.transactionId()).orElse(null);
    }
}
