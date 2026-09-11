package dev.desafio.transaction.transaction.adapter.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.checkout.CheckoutIdempotencyConflictException;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationId;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import dev.desafio.transaction.transaction.domain.Transaction;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.axonframework.messaging.eventhandling.gateway.EventGateway;
import org.testcontainers.containers.PostgreSQLContainer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

@DataJpaTest(properties = {
    "spring.jpa.hibernate.ddl-auto=validate",
    "spring.flyway.enabled=true",
    "spring.flyway.create-schemas=true",
    "spring.flyway.default-schema=axon",
    "spring.flyway.schemas=axon,transaction,inventory,payment"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = JpaTransactionPersistenceTest.TransactionPersistenceTestConfiguration.class)
class JpaTransactionPersistenceTest {
    private static final PostgreSQLContainer<?> POSTGRES = localUrl() == null
        ? new PostgreSQLContainer<>("postgres:16-alpine") : null;
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");

    static {
        if (POSTGRES != null) POSTGRES.start();
    }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> localUrl() != null ? localUrl() : POSTGRES.getJdbcUrl());
        properties.add("spring.datasource.username", () -> env("TEST_POSTGRES_USER", POSTGRES == null ? "postgres" : POSTGRES.getUsername()));
        properties.add("spring.datasource.password", () -> env("TEST_POSTGRES_PASSWORD", POSTGRES == null ? "postgres" : POSTGRES.getPassword()));
    }

    @AfterAll
    static void stopPostgres() {
        if (POSTGRES != null) POSTGRES.stop();
    }

    @Autowired
    private CheckoutOperationJpaRepository checkoutRecords;

    @Autowired
    private TransactionViewJpaRepository transactionRecords;

    @Autowired
    private TransactionOutboxJpaRepository outboxRecords;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("Transaction persistence keeps context-owned entities association-free @spec:AC-298")
    void transactionPersistenceKeepsContextOwnedEntitiesAssociationFree() {
        for (var entity : List.of(
            CheckoutOperationEntity.class,
            TransactionViewEntity.class,
            TransactionOutboxEntity.class
        )) {
            assertFalse(entityManager.getMetamodel().entity(entity).getAttributes().stream()
                .anyMatch(attribute -> attribute.isAssociation()));
        }
    }

    @Test
    @DisplayName("concurrent checkout creation preserves one operation and JSON items across reload @spec:AC-335")
    void concurrentCheckoutCreationPreservesOneOperationAndJsonItemsAcrossReload() {
        var firstRepository = checkoutRepository();
        var secondRepository = checkoutRepository();
        var barrier = new CyclicBarrier(2);
        var operationKey = "operation-" + java.util.UUID.randomUUID();
        var request = request("buyer-1", operationKey, "a".repeat(64));

        var claims = List.of(
            CompletableFuture.supplyAsync(() -> { await(barrier); return firstRepository.createOrLoad(request, NOW); }),
            CompletableFuture.supplyAsync(() -> { await(barrier); return secondRepository.createOrLoad(request, NOW); })
        ).stream().map(CompletableFuture::join).toList();
        assertEquals(1, claims.stream().map(CheckoutOperationRepository.Operation::operationId).distinct().count());
        assertTrue(firstRepository.markWooCreationRequested(request.operationId(), NOW));

        var items = List.of(new Transaction.Item("1001", 2));
        var order = new WooCommerceOrderPort.Order("woo-42-" + operationKey, items, new BigDecimal("39.80"), "BRL");
        firstRepository.recordWooOrder(
            request.operationId(), order, NOW.plusSeconds(31)
        );
        firstRepository.complete(
            request.operationId(), NOW.plusSeconds(31)
        );
        entityManager.clear();

        var reloaded = secondRepository.createOrLoad(request, NOW.plusSeconds(90));
        assertEquals(items, reloaded.items());
        assertEquals(new BigDecimal("39.800000"), reloaded.amount());
        assertEquals(CheckoutOperationRepository.Status.COMPLETED, reloaded.status());
        assertThrows(CheckoutIdempotencyConflictException.class, () -> secondRepository.createOrLoad(new CheckoutOperationRepository.CreateRequest(request.operationId(), request.subject(), request.operationKey(), "b".repeat(64), request.wooReference()), NOW));
    }

    @Test
    @DisplayName("Concurrent creation-requested transition commits exactly once and is independently visible @spec:AC-340")
    void concurrentCreationRequestedTransitionCommitsExactlyOnce() {
        var first = checkoutRepository();
        var second = checkoutRepository();
        var key = "requested-" + java.util.UUID.randomUUID();
        var request = request("buyer-1", key, "c".repeat(64));
        first.createOrLoad(request, NOW);
        var barrier = new CyclicBarrier(2);
        var results = List.of(
            CompletableFuture.supplyAsync(() -> { await(barrier); return first.markWooCreationRequested(request.operationId(), NOW); }),
            CompletableFuture.supplyAsync(() -> { await(barrier); return second.markWooCreationRequested(request.operationId(), NOW); })
        ).stream().map(CompletableFuture::join).toList();
        assertEquals(1, results.stream().filter(Boolean::booleanValue).count());
        assertEquals(CheckoutOperationRepository.Status.WOO_CREATION_REQUESTED, second.createOrLoad(request, NOW).status());
    }

    @Test
    @DisplayName("Concurrent checkout state writes never regress or overwrite a confirmed order @spec:AC-335 @spec:AC-349")
    void concurrentCheckoutStateWritesAreMonotonic() {
        var first = checkoutRepository();
        var second = checkoutRepository();
        var request = request("buyer-1", "monotonic-" + java.util.UUID.randomUUID(), "d".repeat(64));
        first.createOrLoad(request, NOW);
        first.markWooCreationRequested(request.operationId(), NOW);
        var firstOrder = new WooCommerceOrderPort.Order(
            "woo-first-" + request.operationKey(),
            List.of(new Transaction.Item("1001", 1)),
            new BigDecimal("10.00"),
            "BRL"
        );
        var secondOrder = new WooCommerceOrderPort.Order(
            "woo-second-" + request.operationKey(),
            List.of(new Transaction.Item("1002", 1)),
            new BigDecimal("20.00"),
            "BRL"
        );
        var barrier = new CyclicBarrier(2);
        List.of(
            CompletableFuture.runAsync(() -> { await(barrier); first.recordWooOrder(request.operationId(), firstOrder, NOW.plusSeconds(1)); }),
            CompletableFuture.runAsync(() -> { await(barrier); second.recordWooOrder(request.operationId(), secondOrder, NOW.plusSeconds(1)); })
        ).forEach(CompletableFuture::join);

        var confirmed = first.createOrLoad(request, NOW.plusSeconds(2));
        assertEquals(CheckoutOperationRepository.Status.WOO_CONFIRMED, confirmed.status());
        assertTrue(confirmed.wooOrderId().equals(firstOrder.id()) || confirmed.wooOrderId().equals(secondOrder.id()));
        first.complete(request.operationId(), NOW.plusSeconds(3));
        second.recordWooOrder(request.operationId(), secondOrder, NOW.plusSeconds(4));
        assertEquals(CheckoutOperationRepository.Status.COMPLETED, second.createOrLoad(request, NOW.plusSeconds(5)).status());
    }

    @Test
    @DisplayName("Transaction outbox preserves Card credentials and deterministic keys @spec:AC-301 @spec:AC-314 @spec:AC-315")
    void staleProjectionEventsCannotRegressOwnerScopedViews() {
        var suffix = java.util.UUID.randomUUID().toString();
        var started = TransactionEvent.started(new StartTransaction(
            "transaction-" + suffix, "operation-" + suffix, "buyer-1", "woo-" + suffix,
            List.of(new Transaction.Item("1001", 1)), new BigDecimal("19.90"), "BRL", "CARD",
            "provider-token-" + suffix, "visa"
        ), NOW);
        var reserved = TransactionEvent.outcome(
            started.transactionId(), started.operationKey(), started.owner(), started.wooOrderId(),
            started.items(), started.amount(), started.currency(), started.paymentMethod(),
            started.providerToken(), started.paymentMethodId(),
            Transaction.Outcome.INVENTORY_RESERVED, "reservation-1", Transaction.Status.INVENTORY_RESERVED,
            2, NOW.plusSeconds(1)
        );
        var store = new JpaTransactionViewStore(transactionRecords, transactionManager);
        var reads = new JpaTransactionReadRepository(checkoutRecords, transactionRecords);

        store.upsert(started);
        store.upsert(reserved);
        store.upsert(started);
        entityManager.clear();

        var reloaded = reads.findTransaction(started.transactionId(), "buyer-1").orElseThrow();
        assertEquals(2, reloaded.version());
        assertEquals(Transaction.Status.INVENTORY_RESERVED, reloaded.status());
        assertEquals(reloaded, reads.findTransactionByWooOrder(started.wooOrderId(), "buyer-1").orElseThrow());
        assertTrue(reads.findTransaction(started.transactionId(), "another-buyer").isEmpty());
        assertTrue(reads.findTransactionByWooOrder(started.wooOrderId(), "another-buyer").isEmpty());

        var outbox = new JpaTransactionOutbox(
            new ObjectMapper().findAndRegisterModules(), outboxRecords, entityManager, transactionManager
        );
        outbox.enqueueOrderReceived(started);
        outbox.enqueueOrderReceived(started);
        var stored = outboxRecords.findBySourceEventId(started.eventId().toString()).orElseThrow();
        assertEquals("provider-token-" + suffix,
            stored.envelope().path("payload").path("providerCredentialReference").asText());
        assertEquals("visa", stored.envelope().path("payload").path("paymentMethodId").asText());
        assertEquals("operation-" + suffix + ":payment",
            stored.envelope().path("payload").path("paymentOperationKey").asText());
        assertEquals(1, outboxRecords.findBySourceEventId(started.eventId().toString()).stream().count());
        var collision = new TransactionEvent(
            started.eventId(), started.transactionId(), started.operationKey(), "another-buyer",
            started.wooOrderId(), started.items(), started.amount(), started.currency(),
            started.paymentMethod(), started.providerToken(), started.paymentMethodId(),
            started.outcome(), started.reference(), started.status(),
            started.version(), started.occurredAt()
        );
        assertThrows(IllegalArgumentException.class, () -> outbox.enqueueOrderReceived(collision));
    }

    @Test
    @DisplayName("projection and integration outbox rollback together on handler failure @spec:AC-345")
    void projectionAndOutboxRollbackTogetherOnHandlerFailure() {
        var suffix = java.util.UUID.randomUUID().toString();
        var event = TransactionEvent.started(new StartTransaction(
            "transaction-" + suffix, "operation-" + suffix, "buyer-1", "woo-" + suffix,
            List.of(new Transaction.Item("1001", 1)), new BigDecimal("19.90"), "BRL", "CARD",
            "provider-token-" + suffix, "visa"
        ), NOW);
        var views = new JpaTransactionViewStore(transactionRecords, transactionManager);
        var outbox = new JpaTransactionOutbox(
            new ObjectMapper().findAndRegisterModules(), outboxRecords, entityManager, transactionManager
        );
        var handler = new TransactionalTransactionEventHandler(views, (ignored) -> {
            outbox.enqueueOrderReceived(event);
            throw new IllegalStateException("forced outbox failure");
        });

        var boundary = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        boundary.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        assertThrows(IllegalStateException.class, () -> boundary.executeWithoutResult(status -> handler.on(event)));

        entityManager.clear();
        assertTrue(transactionRecords.findByTransactionId(event.transactionId()).isEmpty());
        assertTrue(outboxRecords.findBySourceEventId(event.eventId().toString()).isEmpty());
    }

    @Test
    @DisplayName("Flyway migrations remove checkout leases and validate Transaction mappings @spec:AC-304 @spec:AC-348")
    void flywayMigrationsValidateTransactionJpaMappingsOnPostgres() {
        assertTrue((localUrl() != null ? localUrl() : POSTGRES.getJdbcUrl()).startsWith("jdbc:postgresql:"));
        assertEquals(3, jdbc.queryForObject("""
            select count(*) from information_schema.tables
             where table_schema = 'transaction'
               and table_name in ('checkout_operation', 'transaction_view', 'amqp_outbox')
            """, Integer.class));
        assertTrue(jdbc.queryForObject(
            "select count(*) > 0 from axon.flyway_schema_history where success",
            Boolean.class
        ));
        assertEquals(1, jdbc.queryForObject("select count(*) from information_schema.key_column_usage where table_schema = 'transaction' and table_name = 'checkout_operation' and constraint_name in (select constraint_name from information_schema.table_constraints where table_schema = 'transaction' and table_name = 'checkout_operation' and constraint_type = 'PRIMARY KEY') and column_name = 'operation_id'", Integer.class));
        assertEquals(1, jdbc.queryForObject("select count(*) from pg_indexes where schemaname = 'transaction' and tablename = 'checkout_operation' and indexdef like '%(subject, operation_key)%'", Integer.class));
        assertEquals(0, jdbc.queryForObject("select count(*) from information_schema.columns where table_schema = 'transaction' and table_name = 'checkout_operation' and column_name in ('owner_token', 'lease_until')", Integer.class));
        assertEquals(0, jdbc.queryForObject("select count(*) from pg_indexes where schemaname = 'transaction' and tablename = 'checkout_operation' and indexname like '%lease%'", Integer.class));
        assertTrue(jdbc.queryForObject("select count(*) from information_schema.columns where table_schema = 'transaction' and table_name = 'checkout_operation' and is_nullable = 'NO' and column_name in ('operation_id','operation_key','subject','command_hash','woo_reference','payment_id','status','created_at','updated_at')", Integer.class) >= 9);
    }

    private JpaCheckoutOperationRepository checkoutRepository() {
        return new JpaCheckoutOperationRepository(checkoutRecords, entityManager, transactionManager, mock(EventGateway.class));
    }

    private static CheckoutOperationRepository.CreateRequest request(
        String subject,
        String operationKey,
        String commandHash
    ) {
        return new CheckoutOperationRepository.CreateRequest(
            CheckoutOperationId.from(subject, operationKey).value(),
            subject,
            operationKey,
            commandHash,
            "reference-" + operationKey
        );
    }

    private static void await(CyclicBarrier barrier) {
        try { barrier.await(); } catch (Exception error) { throw new IllegalStateException(error); }
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EntityScan(basePackageClasses = CheckoutOperationEntity.class)
    @EnableJpaRepositories(basePackageClasses = CheckoutOperationJpaRepository.class)
    static class TransactionPersistenceTestConfiguration {}

    private static String localUrl() { return System.getenv("TEST_POSTGRES_URL"); }
    private static String env(String name, String fallback) { return System.getenv().getOrDefault(name, fallback); }
}
