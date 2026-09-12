package dev.desafio.transaction.transaction.application.checkout;

import dev.desafio.transaction.transaction.application.command.CheckoutCommand;
import dev.desafio.transaction.transaction.application.command.CheckoutCommandHash;
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

    public CheckoutService(
        CheckoutOperationRepository operations,
        WooCommerceOrderPort woo,
        TransactionCommands commands,
        Clock clock
    ) {
        this.operations = Objects.requireNonNull(operations, "operations");
        this.woo = Objects.requireNonNull(woo, "woo");
        this.commands = Objects.requireNonNull(commands, "commands");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public CheckoutResult checkout(CheckoutCommand command) {
        var operation = createOrLoadOperation(command);
        if (isTerminal(operation)) return result(operation);

        operation = synchronizeWooState(operation, command);
        startTransactionWhenReady(operation, command);
        return result(operation);
    }

    private CheckoutOperationRepository.Operation createOrLoadOperation(CheckoutCommand command) {
        var operationId = command.operationId().value();
        var request = new CheckoutOperationRepository.CreateRequest(
            operationId,
            command.subject(),
            command.operationKey(),
            CheckoutCommandHash.hash(command),
            CheckoutCommandHash.wooReference(command.subject(), command.operationKey())
        );
        return operations.createOrLoad(request, clock.instant());
    }

    private boolean isTerminal(CheckoutOperationRepository.Operation operation) {
        return operation.status() == CheckoutOperationRepository.Status.COMPLETED
            || operation.status() == CheckoutOperationRepository.Status.FAILED;
    }

    private CheckoutOperationRepository.Operation synchronizeWooState(
        CheckoutOperationRepository.Operation operation,
        CheckoutCommand command
    ) {
        if (operation.status() == CheckoutOperationRepository.Status.PENDING_WOO
            && !operations.markWooCreationRequested(command.operationId().value(), clock.instant())) {
            return operation;
        }

        try {
            return switch (operation.status()) {
                case PENDING_WOO -> createWooOrder(operation, command);
                case WOO_CREATION_REQUESTED -> reconcileWooOrder(operation, command);
                default -> operation;
            };
        } catch (WooCommerceOrderPort.AmbiguousResponseException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalStateException(TransactionErrorMessages.WOO_COMMERCE_CHECKOUT_FAILED, error);
        }
    }

    private CheckoutOperationRepository.Operation createWooOrder(
        CheckoutOperationRepository.Operation operation,
        CheckoutCommand command
    ) throws Exception {
        return operations.recordWooOrder(
            command.operationId().value(),
            woo.createOrFind(wooRequest(operation, command)),
            clock.instant()
        );
    }

    private CheckoutOperationRepository.Operation reconcileWooOrder(
        CheckoutOperationRepository.Operation operation,
        CheckoutCommand command
    ) throws Exception {
        var order = woo.findByReference(wooRequest(operation, command));
        if (order == null) throw new WooCommerceOrderPort.AmbiguousResponseException();
        return operations.recordWooOrder(command.operationId().value(), order, clock.instant());
    }

    private void startTransactionWhenReady(
        CheckoutOperationRepository.Operation operation,
        CheckoutCommand command
    ) {
        if (operation.status() != CheckoutOperationRepository.Status.WOO_CONFIRMED) return;

        var operationId = operation.operationId();
        var order = new WooCommerceOrderPort.Order(
            operation.wooOrderId(),
            operation.items(),
            operation.amount(),
            operation.currency()
        );
        commands.start(new StartTransaction(
            operationId,
            operation.operationKey(),
            operation.subject(),
            order.id(),
            order.items(),
            order.amount(),
            order.currency(),
            command.paymentMethod(),
            command.providerToken(),
            command.paymentMethodId(),
            command.payerEmail()
        )).whenComplete((ignored, error) -> {
            if (error == null) operations.complete(operationId, clock.instant());
        });
    }

    private WooCommerceOrderPort.Request wooRequest(CheckoutOperationRepository.Operation operation, CheckoutCommand command) {
        return new WooCommerceOrderPort.Request(command.subject(), operation.wooReference(), command.paymentMethod(), command.session());
    }

    private CheckoutResult result(CheckoutOperationRepository.Operation operation) {
        return new CheckoutResult(operation.operationId(), operation.status().name(), operation.wooOrderId(), operation.paymentId(), operation.errorReason());
    }

    @FunctionalInterface
    public interface TransactionCommands {
        CompletableFuture<String> start(StartTransaction command);
    }
}
