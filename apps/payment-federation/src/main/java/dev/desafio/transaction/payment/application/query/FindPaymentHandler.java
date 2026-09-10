package dev.desafio.transaction.payment.application.query;

import org.axonframework.messaging.queryhandling.annotation.QueryHandler;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

public final class FindPaymentHandler {
    private final Function<String, Optional<PaymentView>> findById;

    public FindPaymentHandler(Function<String, Optional<PaymentView>> findById) {
        this.findById = Objects.requireNonNull(findById, "findById");
    }

    @QueryHandler
    public Optional<PaymentView> handle(FindPayment query) {
        Objects.requireNonNull(query, "query");
        return findById.apply(query.paymentId());
    }
}
