package dev.desafio.transaction.payment.adapter.graphql;

import dev.desafio.transaction.payment.application.command.AuthorizePayment;
import dev.desafio.transaction.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.transaction.payment.application.query.FindPayment;
import dev.desafio.transaction.payment.application.query.FindPaymentHandler;
import dev.desafio.transaction.payment.application.query.PaymentView;
import org.springframework.graphql.data.federation.EntityMapping;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

import java.util.Optional;

@Controller
public class PaymentController {
    private final Optional<AuthorizePaymentHandler> authorizePayment;
    private final Optional<FindPaymentHandler> findPayment;

    public PaymentController(
        Optional<AuthorizePaymentHandler> authorizePayment,
        Optional<FindPaymentHandler> findPayment
    ) {
        this.authorizePayment = authorizePayment;
        this.findPayment = findPayment;
    }

    @MutationMapping
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_cart:write')")
    public PaymentView authorizePayment(@Argument("input") AuthorizePayment command) {
        return authorizePayment
            .orElseThrow(() -> new IllegalStateException("Payment writes are unavailable"))
            .handle(command);
    }

    @QueryMapping
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public PaymentView payment(@Argument("id") String id) {
        return find(id);
    }

    @EntityMapping("Payment")
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public PaymentView paymentEntity(@Argument("id") String id) {
        return find(id);
    }

    private PaymentView find(String id) {
        return findPayment
            .orElseThrow(() -> new IllegalStateException("Payment reads are unavailable"))
            .handle(new FindPayment(id))
            .orElse(null);
    }
}
