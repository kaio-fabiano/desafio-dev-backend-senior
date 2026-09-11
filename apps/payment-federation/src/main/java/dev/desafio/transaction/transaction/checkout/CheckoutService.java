package dev.desafio.transaction.transaction.checkout;

import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;
import java.time.Clock;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class CheckoutService {
    private final CheckoutOperationRepository operations;
    private final WooCommerceOrderPort woo;
    private final TransactionCommands commands;
    private final Clock clock;

    public CheckoutService(CheckoutOperationRepository operations, WooCommerceOrderPort woo, TransactionCommands commands, Clock clock) {
        this.operations = Objects.requireNonNull(operations, "operations");
        this.woo = Objects.requireNonNull(woo, "woo");
        this.commands = Objects.requireNonNull(commands, "commands");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public CheckoutResult checkout(CheckoutCommand command) {
        var operationId = command.operationId().value();
        var request = new CheckoutOperationRepository.CreateRequest(operationId, command.subject(), command.operationKey(),
            CheckoutCommandHash.hash(command), CheckoutCommandHash.wooReference(command.subject(), command.operationKey()));
        var operation = operations.createOrLoad(request, clock.instant());
        if (operation.status() == CheckoutOperationRepository.Status.COMPLETED || operation.status() == CheckoutOperationRepository.Status.FAILED) return result(operation);
        if (operation.status() == CheckoutOperationRepository.Status.PENDING_WOO && operations.markWooCreationRequested(operationId, clock.instant())) {
            try { operation = operations.recordWooOrder(operationId, woo.createOrFind(wooRequest(operation, command)), clock.instant()); }
            catch (WooCommerceOrderPort.AmbiguousResponseException error) { throw error; }
            catch (Exception error) { throw new IllegalStateException(TransactionErrorMessages.WOO_COMMERCE_CHECKOUT_FAILED, error); }
        } else if (operation.status() == CheckoutOperationRepository.Status.WOO_CREATION_REQUESTED) {
            try {
                var found = woo.findByReference(wooRequest(operation, command));
                if (found == null) throw new WooCommerceOrderPort.AmbiguousResponseException();
                operation = operations.recordWooOrder(operationId, found, clock.instant());
            } catch (WooCommerceOrderPort.AmbiguousResponseException error) { throw error; }
            catch (Exception error) { throw new IllegalStateException(TransactionErrorMessages.WOO_COMMERCE_CHECKOUT_FAILED, error); }
        }
        if (operation.status() == CheckoutOperationRepository.Status.WOO_CONFIRMED) {
            var completedOperationId = operation.operationId();
            var order = new WooCommerceOrderPort.Order(operation.wooOrderId(), operation.items(), operation.amount(), operation.currency());
            commands.start(new StartTransaction(operation.operationId(), operation.operationKey(), operation.subject(), order.id(), order.items(), order.amount(), order.currency(), command.paymentMethod(), command.providerToken(), command.paymentMethodId()))
                .whenComplete((ignored, error) -> { if (error == null) operations.complete(completedOperationId, clock.instant()); });
        }
        return result(operation);
    }
    private WooCommerceOrderPort.Request wooRequest(CheckoutOperationRepository.Operation operation, CheckoutCommand command) {
        return new WooCommerceOrderPort.Request(command.subject(), operation.wooReference(), command.paymentMethod(), command.session());
    }
    private CheckoutResult result(CheckoutOperationRepository.Operation operation) {
        return new CheckoutResult(operation.operationId(), operation.status().name(), operation.wooOrderId(), operation.paymentId(), operation.errorReason());
    }
    @FunctionalInterface
    public interface TransactionCommands { CompletableFuture<String> start(StartTransaction command); }
}
