package dev.desafio.transaction.payment.adapter.graphql;

import dev.desafio.transaction.payment.application.command.AuthorizePayment;
import dev.desafio.transaction.payment.application.command.AuthorizePaymentHandler;
import dev.desafio.transaction.payment.application.query.FindPayment;
import dev.desafio.transaction.payment.application.query.FindPaymentHandler;
import dev.desafio.transaction.payment.application.query.PaymentView;
import graphql.GraphQLContext;
import org.springframework.graphql.data.federation.EntityMapping;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.Optional;
import java.util.Set;

@Controller
public final class PaymentController {
    private static final String SUBJECT = "paymentSubject";
    private static final String SCOPES = "paymentScopes";
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
    public PaymentView authorizePayment(@Argument("input") AuthorizePayment command, GraphQLContext context) {
        requireAccess(context, "cart:write");
        return authorizePayment
            .orElseThrow(() -> new IllegalStateException("Payment writes are unavailable"))
            .handle(command);
    }

    @QueryMapping
    public PaymentView payment(@Argument("id") String id, GraphQLContext context) {
        requireAccess(context, "orders:read");
        return find(id);
    }

    @EntityMapping("Payment")
    public PaymentView paymentEntity(@Argument("id") String id, GraphQLContext context) {
        requireAccess(context, "orders:read");
        return find(id);
    }

    private PaymentView find(String id) {
        return findPayment
            .orElseThrow(() -> new IllegalStateException("Payment reads are unavailable"))
            .handle(new FindPayment(id))
            .orElse(null);
    }

    @SuppressWarnings("unchecked")
    private static void requireAccess(GraphQLContext context, String requiredScope) {
        var subject = context.<String>getOrDefault(SUBJECT, "");
        var scopes = context.<Set<String>>getOrDefault(SCOPES, Set.of());
        if (subject.isBlank() || !scopes.contains(requiredScope)) {
            throw new PaymentAuthorizationException("Payment access denied");
        }
    }

    public static final class PaymentAuthorizationException extends RuntimeException {
        public PaymentAuthorizationException(String message) {
            super(message);
        }
    }
}
