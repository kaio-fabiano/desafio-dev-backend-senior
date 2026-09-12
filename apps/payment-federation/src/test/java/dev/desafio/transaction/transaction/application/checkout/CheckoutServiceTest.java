package dev.desafio.transaction.transaction.application.checkout;

import dev.desafio.transaction.transaction.application.command.CheckoutCommand;
import dev.desafio.transaction.transaction.application.command.CheckoutCommandHash;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CheckoutServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final CheckoutCommand COMMAND = new CheckoutCommand(
        "buyer-1",
        "operation-1",
        "CARD",
        "buyer@example.test",
        "provider-token",
        "visa"
    );
    private static final WooCommerceOrderPort.Order ORDER = new WooCommerceOrderPort.Order(
        "woo-42",
        List.of(new Transaction.Item("1001", 2)),
        new BigDecimal("19.90"),
        "BRL"
    );

    @Test
    @DisplayName("Java preserves the Node checkout hash and Woo operation reference fixtures @spec:AC-285")
    void javaPreservesTheNodeCheckoutHashAndWooOperationReferenceFixtures() {
        assertEquals(
            "1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0",
            CheckoutCommandHash.hash(COMMAND)
        );
        assertEquals(
            "order-workflow-55481d1f7ae76f7a8f235a304f5980deaa321a9c3d42d73430ccb34df8ac15f8",
            CheckoutCommandHash.wooReference("buyer-1", "operation-1")
        );
    }

    @Test
    @DisplayName("Checkout starts Transaction with exact Card credentials and operation key @spec:AC-314 @spec:AC-315 @spec:AC-316")
    void checkoutStartsTransactionWithExactCardCredentialsAndOperationKey() {
        var started = new AtomicReference<StartTransaction>();
        var service = service(new MemoryCheckoutRepository(), request -> ORDER, command -> {
            started.set(command);
            return CompletableFuture.completedFuture(command.transactionId());
        });

        service.checkout(COMMAND);

        assertEquals("operation-1", started.get().operationKey());
        assertEquals("provider-token", started.get().providerToken());
        assertEquals("visa", started.get().paymentMethodId());
    }

    @Test
    @DisplayName("Concurrent identical checkout observes one Transaction and one Woo order @spec:AC-335 @spec:AC-339")
    void concurrentIdenticalCheckoutObservesOneTransactionAndOneWooOrder() throws Exception {
        var repository = new MemoryCheckoutRepository();
        var createStarted = new CountDownLatch(1);
        var releaseCreation = new CountDownLatch(1);
        var creations = new AtomicInteger();
        WooCommerceOrderPort woo = new WooCommerceOrderPort() {
            @Override
            public Order createOrFind(Request request) throws Exception {
                creations.incrementAndGet();
                createStarted.countDown();
                assertTrue(releaseCreation.await(10, TimeUnit.SECONDS));
                return ORDER;
            }

            @Override
            public Order findByReference(Request request) {
                return ORDER;
            }
        };
        var dispatches = new AtomicInteger();
        var service = service(repository, woo, command -> {
            dispatches.incrementAndGet();
            return CompletableFuture.completedFuture(command.transactionId());
        });

        var first = CompletableFuture.supplyAsync(() -> service.checkout(COMMAND));
        assertTrue(createStarted.await(10, TimeUnit.SECONDS));
        var second = CompletableFuture.supplyAsync(() -> service.checkout(COMMAND));
        releaseCreation.countDown();

        assertEquals(first.get(10, TimeUnit.SECONDS).operationId(), second.get(10, TimeUnit.SECONDS).operationId());
        assertEquals(1, creations.get());
        assertEquals(1, dispatches.get());
    }

    @Test
    @DisplayName("Checkout credential retries conflict deterministically without side effects @spec:AC-334")
    void checkoutConflictsDeterministicallyWithoutSideEffects() {
        var repository = new MemoryCheckoutRepository();
        var service = service(repository, request -> ORDER, command -> CompletableFuture.completedFuture(command.transactionId()));
        service.checkout(COMMAND);

        assertThrows(
            CheckoutIdempotencyConflictException.class,
            () -> service.checkout(new CheckoutCommand(
                "buyer-1", "operation-1", "CARD", "buyer@example.test", "another-provider-token", "visa"
            ))
        );

    }

    @Test
    @DisplayName("Ambiguous Woo success is reconciled before checkout retries creation @spec:AC-341")
    void ambiguousWooSuccessIsReconciledBeforeCheckoutRetriesCreation() {
        var repository = new MemoryCheckoutRepository();
        var creations = new AtomicInteger();
        WooCommerceOrderPort woo = new WooCommerceOrderPort() {
            @Override
            public Order createOrFind(Request request) {
                creations.incrementAndGet();
                throw new WooCommerceOrderPort.AmbiguousResponseException();
            }

            @Override
            public Order findByReference(Request request) {
                return ORDER;
            }
        };
        var service = service(repository, woo, command -> CompletableFuture.completedFuture(command.transactionId()));

        assertThrows(WooCommerceOrderPort.AmbiguousResponseException.class, () -> service.checkout(COMMAND));
        var result = service.checkout(COMMAND);

        assertEquals("woo-42", result.wooOrderId());
        assertEquals(1, creations.get());
        assertEquals(CheckoutOperationRepository.Status.COMPLETED, repository.operation.status());
    }

    @Test
    @DisplayName("Checkout identity is deterministic and scoped by subject and operation key @spec:AC-333")
    void checkoutIdentityIsDeterministicAndScopedBySubjectAndOperationKey() {
        var first = service(new MemoryCheckoutRepository(), request -> ORDER, command -> CompletableFuture.completedFuture(command.transactionId()))
            .checkout(COMMAND);
        var otherSubject = service(new MemoryCheckoutRepository(), request -> ORDER, command -> CompletableFuture.completedFuture(command.transactionId()))
            .checkout(new CheckoutCommand("buyer-2", "operation-1", "CARD", "buyer@example.test", "provider-token", "visa"));

        assertEquals(first.operationId(), service(new MemoryCheckoutRepository(), request -> ORDER, command -> CompletableFuture.completedFuture(command.transactionId())).checkout(COMMAND).operationId());
        assertEquals(CheckoutOperationId.from("buyer-2", "operation-1").value(), otherSubject.operationId());
    }

    @Test
    @DisplayName("Operation identity and semantic command hash are deterministic independently @spec:AC-333")
    void operationIdentityAndCommandHashAreDeterministicIndependently() {
        var same = new CheckoutCommand("buyer-1", "operation-1", "CARD", "buyer@example.test", "provider-token", "visa");

        assertEquals(CheckoutOperationId.from("buyer-1", "operation-1"), COMMAND.operationId());
        assertEquals(COMMAND.operationId(), same.operationId());
        assertEquals(CheckoutCommandHash.hash(COMMAND), CheckoutCommandHash.hash(same));
    }

    @Test
    @DisplayName("Canonical checkout construction rejects an inconsistent explicit operation identity @spec:AC-333")
    void canonicalCheckoutConstructionRejectsInconsistentExplicitOperationIdentity() {
        assertThrows(IllegalArgumentException.class, () -> new CheckoutCommand(
            "buyer-1", "operation-1", "CARD", "buyer@example.test", "provider-token", "visa", null,
            new CheckoutOperationId("00000000-0000-0000-0000-000000000000")
        ));
    }

    @Test
    @DisplayName("The same operation key may be used by different subjects @spec:AC-335")
    void operationKeyIsScopedBySubject() {
        var repository = new MemoryCheckoutRepository();
        var service = service(repository, request -> ORDER, command -> CompletableFuture.completedFuture(command.transactionId()));

        service.checkout(COMMAND);

        service.checkout(new CheckoutCommand("buyer-2", "operation-1", "CARD", "buyer@example.test", "provider-token", "visa"));
    }

    @Test
    @DisplayName("Duplicate checkout returns without waiting for the first request @spec:AC-337")
    void duplicateCheckoutDoesNotWaitForAnotherRequest() throws Exception {
        var repository = new MemoryCheckoutRepository();
        var creationStarted = new CountDownLatch(1);
        var releaseCreation = new CountDownLatch(1);
        var woo = new WooCommerceOrderPort() {
            @Override
            public Order createOrFind(Request request) throws Exception {
                creationStarted.countDown();
                assertTrue(releaseCreation.await(10, TimeUnit.SECONDS));
                return ORDER;
            }

            @Override
            public Order findByReference(Request request) {
                return ORDER;
            }
        };
        var service = service(repository, woo, command -> CompletableFuture.completedFuture(command.transactionId()));
        CompletableFuture.supplyAsync(() -> service.checkout(COMMAND));
        assertTrue(creationStarted.await(10, TimeUnit.SECONDS));

        var duplicate = CompletableFuture.supplyAsync(() -> service.checkout(COMMAND));

        try {
            assertTrue(duplicate.get(5, TimeUnit.SECONDS) != null, "duplicate must return current durable state promptly");
        } finally {
            releaseCreation.countDown();
        }
    }

    @Test
    @DisplayName("Woo creation is requested before the first external create @spec:AC-340")
    void wooCreationIsRequestedBeforeExternalCreate() {
        var repository = new MemoryCheckoutRepository();
        var requested = new AtomicReference<CheckoutOperationRepository.Status>();
        var service = service(repository, request -> { requested.set(repository.operation.status()); return ORDER; }, command -> CompletableFuture.completedFuture(command.transactionId()));

        service.checkout(COMMAND);

        assertEquals(CheckoutOperationRepository.Status.WOO_CREATION_REQUESTED, requested.get());
    }

    @Test
    @DisplayName("A missing reconciliation result keeps the requested state and never creates again @spec:AC-341 @spec:AC-349")
    void missingReconciliationResultKeepsRequestedState() {
        var repository = new MemoryCheckoutRepository();
        var creations = new AtomicInteger();
        WooCommerceOrderPort woo = new WooCommerceOrderPort() {
            public Order createOrFind(Request request) { creations.incrementAndGet(); throw new WooCommerceOrderPort.AmbiguousResponseException(); }
            public Order findByReference(Request request) { return null; }
        };
        var service = service(repository, woo, command -> CompletableFuture.completedFuture(command.transactionId()));

        assertThrows(WooCommerceOrderPort.AmbiguousResponseException.class, () -> service.checkout(COMMAND));
        assertThrows(WooCommerceOrderPort.AmbiguousResponseException.class, () -> service.checkout(COMMAND));
        assertEquals(1, creations.get());
        assertEquals(CheckoutOperationRepository.Status.WOO_CREATION_REQUESTED, repository.operation.status());
    }

    @Test
    @DisplayName("Async Transaction failure leaves Woo confirmation retryable @spec:AC-349")
    void asyncTransactionFailureLeavesWooConfirmationRetryable() {
        var repository = new MemoryCheckoutRepository();
        var failure = new CompletableFuture<String>();
        var service = service(repository, request -> ORDER, command -> failure);

        service.checkout(COMMAND);
        failure.completeExceptionally(new IllegalStateException("retryable"));

        assertEquals(CheckoutOperationRepository.Status.WOO_CONFIRMED, repository.operation.status());
    }

    private CheckoutService service(
        CheckoutOperationRepository repository,
        WooCommerceOrderPort woo,
        CheckoutService.TransactionCommands commands
    ) {
        return new CheckoutService(repository, woo, commands, CLOCK);
    }

    private static final class MemoryCheckoutRepository implements CheckoutOperationRepository {
        private Operation operation;
        @Override public synchronized Operation createOrLoad(CreateRequest request, Instant now) {
            if (operation == null || !operation.subject().equals(request.subject())) operation = new Operation(request.operationId(), request.operationKey(), request.subject(), request.commandHash(), request.wooReference(), null, Status.PENDING_WOO);
            else if (!operation.commandHash().equals(request.commandHash())) throw new CheckoutIdempotencyConflictException();
            return operation;
        }
        @Override public synchronized boolean markWooCreationRequested(String id, Instant now) {
            if (operation.status() != Status.PENDING_WOO) return false;
            operation = operation.withStatus(Status.WOO_CREATION_REQUESTED); return true;
        }
        @Override public synchronized Operation recordWooOrder(String id, WooCommerceOrderPort.Order order, Instant now) { operation = operation.withWooOrder(order).withStatus(Status.WOO_CONFIRMED); return operation; }
        @Override public synchronized Operation complete(String id, Instant now) { operation = operation.withStatus(Status.COMPLETED); return operation; }
        @Override public synchronized Operation fail(String id, String reason, Instant now) { operation = operation.withError(reason); return operation; }
        @Override public synchronized java.util.Optional<Operation> find(String id, String subject) { return operation == null ? java.util.Optional.empty() : java.util.Optional.of(operation); }
    }
}
