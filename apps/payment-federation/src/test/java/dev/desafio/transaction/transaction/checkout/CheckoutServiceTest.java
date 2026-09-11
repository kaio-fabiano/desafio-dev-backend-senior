package dev.desafio.transaction.transaction.checkout;

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
            return command.transactionId();
        });

        service.checkout(COMMAND);

        assertEquals("operation-1", started.get().operationKey());
        assertEquals("provider-token", started.get().providerToken());
        assertEquals("visa", started.get().paymentMethodId());
    }

    @Test
    @DisplayName("Concurrent identical checkout observes one Transaction and one Woo order @spec:AC-285 @spec:AC-229 @spec:AC-316")
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
                assertTrue(releaseCreation.await(2, TimeUnit.SECONDS));
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
            return command.transactionId();
        });

        var first = CompletableFuture.supplyAsync(() -> service.checkout(COMMAND));
        assertTrue(createStarted.await(2, TimeUnit.SECONDS));
        var second = CompletableFuture.supplyAsync(() -> service.checkout(COMMAND));
        releaseCreation.countDown();

        assertEquals(first.get(2, TimeUnit.SECONDS), second.get(2, TimeUnit.SECONDS));
        assertEquals(1, creations.get());
        assertEquals(1, dispatches.get());
    }

    @Test
    @DisplayName("Checkout credential retries conflict deterministically and bound a busy lease wait @spec:AC-285 @spec:AC-229 @spec:AC-315 @spec:AC-316")
    void checkoutConflictsDeterministicallyAndBoundsABusyLeaseWait() {
        var repository = new MemoryCheckoutRepository();
        var service = service(repository, request -> ORDER, command -> command.transactionId());
        service.checkout(COMMAND);

        assertThrows(
            CheckoutIdempotencyConflictException.class,
            () -> service.checkout(new CheckoutCommand(
                "buyer-1", "operation-1", "CARD", "buyer@example.test", "another-provider-token", "visa"
            ))
        );

        var busyRepository = new MemoryCheckoutRepository();
        busyRepository.alwaysBusy = true;
        var started = System.nanoTime();
        assertThrows(CheckoutBusyException.class, () -> service(
            busyRepository,
            request -> ORDER,
            command -> command.transactionId()
        ).checkout(COMMAND));
        assertTrue(Duration.ofNanos(System.nanoTime() - started).compareTo(Duration.ofSeconds(1)) < 0);
    }

    @Test
    @DisplayName("Ambiguous Woo success is reconciled before checkout retries creation @spec:AC-285 @spec:AC-229 @spec:AC-243 @spec:AC-316")
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
        var service = service(repository, woo, command -> command.transactionId());

        assertThrows(WooCommerceOrderPort.AmbiguousResponseException.class, () -> service.checkout(COMMAND));
        var result = service.checkout(COMMAND);

        assertEquals("woo-42", result.wooOrderId());
        assertEquals(1, creations.get());
        assertEquals(CheckoutOperationRepository.Status.COMPLETED, repository.operation.status());
    }

    private CheckoutService service(
        CheckoutOperationRepository repository,
        WooCommerceOrderPort woo,
        CheckoutService.TransactionCommands commands
    ) {
        return new CheckoutService(repository, woo, commands, CLOCK, Duration.ofMillis(200));
    }

    private static final class MemoryCheckoutRepository implements CheckoutOperationRepository {
        private Operation operation;
        private String owner;
        private boolean alwaysBusy;

        @Override
        public synchronized Claim claim(ClaimRequest request, Instant now, Duration lease) {
            if (operation == null) {
                operation = new Operation(
                    "transaction-1", request.operationKey(), request.subject(), request.commandHash(),
                    request.wooReference(), null, Status.PENDING_WOO
                );
            }
            if (!operation.subject().equals(request.subject())
                || !operation.commandHash().equals(request.commandHash())) {
                throw new CheckoutIdempotencyConflictException();
            }
            if (operation.status() == Status.COMPLETED) return new Claim(operation, null);
            if (alwaysBusy || owner != null) return new Claim(operation, null);
            owner = "owner-1";
            return new Claim(operation, owner);
        }

        @Override
        public synchronized void beginWooCreation(String transactionId, String ownerToken, Instant now) {
            requireOwner(ownerToken);
            operation = operation.withStatus(Status.CREATING_WOO);
        }

        @Override
        public synchronized Operation recordWooOrder(
            String transactionId,
            String ownerToken,
            WooCommerceOrderPort.Order order,
            Instant now
        ) {
            requireOwner(ownerToken);
            operation = operation.withWooOrder(order).withStatus(Status.WOO_CONFIRMED);
            return operation;
        }

        @Override
        public synchronized Operation complete(String transactionId, String ownerToken, Instant now) {
            requireOwner(ownerToken);
            operation = operation.withStatus(Status.COMPLETED);
            owner = null;
            return operation;
        }

        @Override
        public synchronized void release(String transactionId, String ownerToken, Instant now) {
            requireOwner(ownerToken);
            owner = null;
        }

        private void requireOwner(String ownerToken) {
            if (!ownerToken.equals(owner)) throw new IllegalStateException("checkout lease was lost");
        }
    }
}
