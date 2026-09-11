package dev.desafio.transaction.subscription;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.subscription.CheckoutOperationUpdated;
import dev.desafio.transaction.transaction.application.subscription.CheckoutOperationUpdatedHandler;
import dev.desafio.transaction.transaction.application.subscription.CheckoutSubscriptionGateway;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import reactor.core.publisher.Flux;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CheckoutSubscriptionTest {
    @Test
    void matchesOnlyTheOwnedOperation() {
        var query = new CheckoutOperationUpdated("operation-1", "buyer-1");
        assertTrue(query.matches(new CheckoutOperationView(
            "operation-1", "key-1", "PROCESSING", null, "payment:operation-1", null, "buyer-1"
        )));
    }

    @Test
    @DisplayName("Reconnect reads durable state and suppresses stale updates @spec:AC-344")
    void reconnectReadsTheDurableOwnedValueAndSuppressesStaleStatusesUntilCancelled() {
        var views = mock(TransactionReadRepository.class);
        var current = new CheckoutOperationView("operation-1", "key-1", "COMPLETED", "42", "payment:operation-1", null, "buyer-1");
        when(views.findCheckout("operation-1", "buyer-1")).thenReturn(Optional.of(current));
        var cancelled = new AtomicBoolean();
        CheckoutSubscriptionGateway gateway = query -> Flux.just(
            new CheckoutOperationView("operation-1", "key-1", "PROCESSING", null, "payment:operation-1", null, "buyer-1"),
            new CheckoutOperationView("operation-1", "key-1", "PROCESSING", null, "payment:operation-1", null, "buyer-1"),
            current
        ).concatWith(Flux.never()).doOnCancel(() -> cancelled.set(true));
        var handler = new CheckoutOperationUpdatedHandler(gateway, views);
        var statuses = new CopyOnWriteArrayList<String>();
        var subscription = handler.subscribe("operation-1", "buyer-1").subscribe(view -> statuses.add(view.status()));

        assertEquals(java.util.List.of("PROCESSING", "COMPLETED"), statuses);
        assertEquals(Optional.of(current), handler.initialResult(new CheckoutOperationUpdated("operation-1", "buyer-1")));
        subscription.dispose();
        assertTrue(cancelled.get());
        verify(views).findCheckout("operation-1", "buyer-1");
    }

    @Test
    void doesNotReconnectAcrossOwners() {
        var views = mock(TransactionReadRepository.class);
        when(views.findCheckout("operation-1", "other-buyer")).thenReturn(Optional.empty());
        var handler = new CheckoutOperationUpdatedHandler(query -> Flux.empty(), views);
        assertTrue(handler.initialResult(new CheckoutOperationUpdated("operation-1", "other-buyer")).isEmpty());
    }

    @Test
    @DisplayName("Terminal checkout status cannot regress to processing @spec:AC-344")
    void suppressesStatusRegressionAndEmitsFailedTerminalUpdate() {
        CheckoutSubscriptionGateway gateway = query -> Flux.just(
            view("PROCESSING"), view("FAILED"), view("PROCESSING")
        );
        var statuses = new CheckoutOperationUpdatedHandler(gateway, mock(TransactionReadRepository.class))
            .subscribe("operation-1", "buyer-1")
            .map(CheckoutOperationView::status)
            .collectList()
            .block();

        assertEquals(java.util.List.of("PROCESSING", "FAILED"), statuses);
    }

    private static CheckoutOperationView view(String status) {
        return new CheckoutOperationView("operation-1", "key-1", status, null, "payment:operation-1", null, "buyer-1");
    }
}
