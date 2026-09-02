package dev.desafio.transaction.payment.application.query;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

public final class FindPaymentHandler {
    private final Function<String, Optional<PaymentView>> findById;

    public FindPaymentHandler(Function<String, Optional<PaymentView>> findById) {
        this.findById = Objects.requireNonNull(findById, "findById");
    }

    public Optional<PaymentView> handle(FindPayment query) {
        Objects.requireNonNull(query, "query");
        return findById.apply(query.paymentId());
    }
}
