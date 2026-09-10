package dev.desafio.transaction.shared.interfaces.graphql;

import dev.desafio.transaction.transaction.checkout.CheckoutBusyException;
import dev.desafio.transaction.transaction.checkout.CheckoutIdempotencyConflictException;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import graphql.GraphQLError;
import graphql.GraphqlErrorBuilder;
import graphql.schema.DataFetchingEnvironment;
import org.springframework.graphql.execution.DataFetcherExceptionResolverAdapter;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public final class GraphQlErrorResolver extends DataFetcherExceptionResolverAdapter {
    @Override
    protected GraphQLError resolveToSingleError(Throwable error, DataFetchingEnvironment environment) {
        var cause = unwrap(error);
        var code = switch (cause) {
            case CheckoutIdempotencyConflictException ignored -> "CHECKOUT_IDEMPOTENCY_CONFLICT";
            case CheckoutBusyException ignored -> "CHECKOUT_RECONCILIATION_PENDING";
            case WooCommerceOrderPort.AmbiguousResponseException ignored -> "CHECKOUT_RECONCILIATION_PENDING";
            case IllegalArgumentException ignored -> "CHECKOUT_INPUT_INVALID";
            case AccessDeniedException ignored -> "FORBIDDEN";
            default -> null;
        };
        return code == null ? null : GraphqlErrorBuilder.newError(environment)
            .message(cause.getMessage())
            .extensions(Map.of("code", code))
            .build();
    }

    private static Throwable unwrap(Throwable error) {
        var cause = error;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause;
    }
}
