package dev.desafio.transaction.transaction.checkout;

import dev.desafio.transaction.transaction.application.command.StartTransaction;

import java.time.Clock;
import java.time.Duration;
import java.util.Objects;

public final class CheckoutService {
    private static final Duration LEASE = Duration.ofSeconds(30);
    private static final Duration POLL = Duration.ofMillis(10);

    private final CheckoutOperationRepository operations;
    private final WooCommerceOrderPort woo;
    private final TransactionCommands commands;
    private final Clock clock;
    private final Duration waitTimeout;

    public CheckoutService(
        CheckoutOperationRepository operations,
        WooCommerceOrderPort woo,
        TransactionCommands commands,
        Clock clock,
        Duration waitTimeout
    ) {
        this.operations = Objects.requireNonNull(operations, "operations");
        this.woo = Objects.requireNonNull(woo, "woo");
        this.commands = Objects.requireNonNull(commands, "commands");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.waitTimeout = Objects.requireNonNull(waitTimeout, "waitTimeout");
    }

    public CheckoutResult checkout(CheckoutCommand command) {
        var request = new CheckoutOperationRepository.ClaimRequest(
            command.subject(), command.operationKey(), CheckoutCommandHash.hash(command),
            CheckoutCommandHash.wooReference(command.subject(), command.operationKey())
        );
        var deadline = System.nanoTime() + waitTimeout.toNanos();
        CheckoutOperationRepository.Claim claim;
        for (;;) {
            claim = operations.claim(request, clock.instant(), LEASE);
            if (claim.operation().status() == CheckoutOperationRepository.Status.COMPLETED) {
                return result(claim.operation());
            }
            if (claim.ownerToken() != null) break;
            if (System.nanoTime() >= deadline) throw new CheckoutBusyException();
            sleep();
        }

        var operation = claim.operation();
        var owner = claim.ownerToken();
        try {
            if (operation.status() == CheckoutOperationRepository.Status.PENDING_WOO) {
                operations.beginWooCreation(operation.transactionId(), owner, clock.instant());
                operation = operations.recordWooOrder(
                    operation.transactionId(), owner, woo.createOrFind(wooRequest(operation, command)), clock.instant()
                );
            } else if (operation.status() == CheckoutOperationRepository.Status.CREATING_WOO) {
                var reconciled = woo.findByReference(wooRequest(operation, command));
                if (reconciled == null) throw new WooCommerceOrderPort.AmbiguousResponseException();
                operation = operations.recordWooOrder(
                    operation.transactionId(), owner, reconciled, clock.instant()
                );
            }

            if (operation.status() == CheckoutOperationRepository.Status.WOO_CONFIRMED) {
                var order = requireOrder(operation);
                commands.start(new StartTransaction(
                    operation.transactionId(), operation.operationKey(), operation.subject(), order.id(),
                    order.items(), order.amount(), order.currency(), command.paymentMethod()
                ));
                operation = operations.complete(operation.transactionId(), owner, clock.instant());
            }
            return result(operation);
        } catch (RuntimeException error) {
            operations.release(operation.transactionId(), owner, clock.instant());
            throw error;
        } catch (Exception error) {
            operations.release(operation.transactionId(), owner, clock.instant());
            throw new IllegalStateException("WooCommerce checkout failed", error);
        }
    }

    private WooCommerceOrderPort.Order requireOrder(CheckoutOperationRepository.Operation operation) {
        return new WooCommerceOrderPort.Order(
            operation.wooOrderId(), operation.items(), operation.amount(), operation.currency()
        );
    }

    private WooCommerceOrderPort.Request wooRequest(
        CheckoutOperationRepository.Operation operation,
        CheckoutCommand command
    ) {
        return new WooCommerceOrderPort.Request(
            command.subject(), operation.wooReference(), command.paymentMethod(), command.session()
        );
    }

    private CheckoutResult result(CheckoutOperationRepository.Operation operation) {
        return new CheckoutResult(operation.transactionId(), operation.wooOrderId());
    }

    private void sleep() {
        try {
            Thread.sleep(POLL.toMillis());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new CheckoutBusyException();
        }
    }

    @FunctionalInterface
    public interface TransactionCommands {
        String start(StartTransaction command);
    }

}
