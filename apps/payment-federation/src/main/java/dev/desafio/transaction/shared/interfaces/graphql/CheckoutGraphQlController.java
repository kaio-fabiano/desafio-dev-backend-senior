package dev.desafio.transaction.shared.interfaces.graphql;

import dev.desafio.transaction.inventory.application.query.FindInventoryReservationByTransaction;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.payment.application.query.FindPaymentByTransaction;
import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.FindCheckoutOperation;
import dev.desafio.transaction.transaction.application.query.FindOwnedTransaction;
import dev.desafio.transaction.transaction.application.query.FindTransactionByWooOrder;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.checkout.CheckoutResult;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import graphql.schema.DataFetchingEnvironment;
import org.axonframework.extension.reactor.messaging.commandhandling.gateway.ReactorCommandGateway;
import org.axonframework.extension.reactor.messaging.queryhandling.gateway.ReactorQueryGateway;
import org.springframework.graphql.data.federation.EntityMapping;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Base64;
import java.util.Optional;

@Controller
public class CheckoutGraphQlController {
    private final ReactorCommandGateway commands;
    private final ReactorQueryGateway queries;

    public CheckoutGraphQlController(ReactorCommandGateway commands, ReactorQueryGateway queries) {
        this.commands = commands;
        this.queries = queries;
    }

    @MutationMapping
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_cart:write')")
    public Mono<CheckoutOperationView> startCheckout(
        @Argument("input") CheckoutInput input,
        Principal principal,
        DataFetchingEnvironment environment
    ) {
        var context = environment.getGraphQlContext();
        var session = new WooCommerceOrderPort.Session(
            context.getOrDefault("cartToken", ""),
            context.getOrDefault("wooSession", ""),
            context.getOrDefault("cookie", "")
        );
        return commands.send(input.command(principal.getName(), session), CheckoutResult.class)
            .map(result -> new CheckoutOperationView(
                result.operationId(), input.operationKey(), checkoutStatus(result.status()), result.orderId(),
                result.paymentId(), result.errorReason()
            ));
    }

    private static String checkoutStatus(String status) {
        return switch (status) {
            case "PENDING_WOO", "WOO_CREATION_REQUESTED", "WOO_CONFIRMED" -> "PROCESSING";
            case "COMPLETED", "FAILED" -> status;
            default -> throw new IllegalArgumentException("Unsupported checkout status");
        };
    }

    @QueryMapping
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public Mono<CheckoutOperationView> checkout(
        @Argument("id") String id,
        Principal principal
    ) {
        return queries.query(
            new FindCheckoutOperation(id, principal.getName()), CheckoutOperationView.class
        ).subscribeOn(Schedulers.boundedElastic());
    }

    @EntityMapping("CheckoutOperation")
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public Mono<CheckoutOperationView> checkoutEntity(
        @Argument("id") String id,
        Principal principal
    ) {
        return checkout(id, principal);
    }

    @EntityMapping("Order")
    @PreAuthorize("authentication.name != null && !authentication.name.isBlank() && hasAuthority('SCOPE_orders:read')")
    public Mono<OrderView> order(
        @Argument("id") String id,
        Principal principal
    ) {
        return queries.query(
            new FindTransactionByWooOrder(wooOrderId(id), principal.getName()),
            TransactionView.class
        ).flatMap(this::withContextViews).subscribeOn(Schedulers.boundedElastic());
    }

    private Mono<OrderView> findOrder(String transactionId, String owner) {
        return queries.query(new FindOwnedTransaction(transactionId, owner), TransactionView.class)
            .flatMap(this::withContextViews);
    }

    private Mono<OrderView> withContextViews(TransactionView transaction) {
        var payment = optionalQuery(
            new FindPaymentByTransaction(transaction.transactionId()), PaymentView.class
        );
        var inventory = optionalQuery(
            new FindInventoryReservationByTransaction(transaction.transactionId()),
            InventoryReservationView.class
        );
        return Mono.zip(payment, inventory)
            .map(views -> OrderView.from(transaction, views.getT1(), views.getT2()));
    }

    private <T> Mono<Optional<T>> optionalQuery(Object query, Class<T> responseType) {
        return queries.query(query, responseType).map(Optional::of).defaultIfEmpty(Optional.empty());
    }

    private static String wooOrderId(String id) {
        try {
            var decoded = new String(Base64.getDecoder().decode(id), StandardCharsets.UTF_8);
            if (!decoded.matches("post:[1-9]\\d*")) {
                throw new IllegalArgumentException(GraphQlErrorMessages.WOO_ORDER_ID);
            }
            return decoded.substring("post:".length());
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException(GraphQlErrorMessages.WOO_ORDER_ID, error);
        }
    }
}
