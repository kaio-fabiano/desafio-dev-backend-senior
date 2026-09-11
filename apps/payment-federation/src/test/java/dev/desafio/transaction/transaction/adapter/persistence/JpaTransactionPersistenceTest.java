package dev.desafio.transaction.transaction.adapter.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.checkout.CheckoutIdempotencyConflictException;
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
import org.testcontainers.containers.PostgreSQLContainer;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @AfterAll
    static void stopPostgres() {
        POSTGRES.stop();
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
    @DisplayName("concurrent checkout claims preserve one lease and JSON items across reload @spec:AC-301")
    void concurrentCheckoutClaimsPreserveOneLeaseAndJsonItemsAcrossReload() {
        var repository = checkoutRepository();
        var operationKey = "operation-" + java.util.UUID.randomUUID();
        var request = new CheckoutOperationRepository.ClaimRequest(
            "buyer-1", operationKey, "a".repeat(64), "reference-" + operationKey
        );

        var claims = List.of(
            CompletableFuture.supplyAsync(() -> repository.claim(request, NOW, Duration.ofSeconds(30))),
            CompletableFuture.supplyAsync(() -> repository.claim(request, NOW, Duration.ofSeconds(30)))
        ).stream().map(CompletableFuture::join).toList();

        assertEquals(1, claims.stream().filter(claim -> claim.ownerToken() != null).count());
        assertEquals(1, claims.stream().map(claim -> claim.operation().transactionId()).distinct().count());
        var first = claims.stream().filter(claim -> claim.ownerToken() != null).findFirst().orElseThrow();
        repository.beginWooCreation(first.operation().transactionId(), first.ownerToken(), NOW);

        var recovered = repository.claim(request, NOW.plusSeconds(31), Duration.ofSeconds(30));
        assertNotNull(recovered.ownerToken());
        assertEquals(CheckoutOperationRepository.Status.CREATING_WOO, recovered.operation().status());

        var items = List.of(new Transaction.Item("1001", 2));
        var order = new WooCommerceOrderPort.Order("woo-42-" + operationKey, items, new BigDecimal("39.80"), "BRL");
        repository.recordWooOrder(
            recovered.operation().transactionId(), recovered.ownerToken(), order, NOW.plusSeconds(31)
        );
        repository.complete(
            recovered.operation().transactionId(), recovered.ownerToken(), NOW.plusSeconds(31)
        );
        entityManager.clear();

        var reloaded = repository.claim(request, NOW.plusSeconds(90), Duration.ofSeconds(30));
        assertNull(reloaded.ownerToken());
        assertEquals(items, reloaded.operation().items());
        assertEquals(new BigDecimal("39.800000"), reloaded.operation().amount());
        assertEquals(CheckoutOperationRepository.Status.COMPLETED, reloaded.operation().status());
        assertThrows(CheckoutIdempotencyConflictException.class, () -> repository.claim(
            new CheckoutOperationRepository.ClaimRequest(
                request.subject(), request.operationKey(), request.commandHash(), "another-reference-" + operationKey
            ), NOW.plusSeconds(90), Duration.ofSeconds(30)
        ));
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
    @DisplayName("Flyway migrations validate Transaction JPA mappings on PostgreSQL @spec:AC-304")
    void flywayMigrationsValidateTransactionJpaMappingsOnPostgres() {
        assertTrue(POSTGRES.getJdbcUrl().startsWith("jdbc:postgresql:"));
        assertEquals(3, jdbc.queryForObject("""
            select count(*) from information_schema.tables
             where table_schema = 'transaction'
               and table_name in ('checkout_operation', 'transaction_view', 'amqp_outbox')
            """, Integer.class));
        assertTrue(jdbc.queryForObject(
            "select count(*) > 0 from axon.flyway_schema_history where success",
            Boolean.class
        ));
    }

    private JpaCheckoutOperationRepository checkoutRepository() {
        return new JpaCheckoutOperationRepository(checkoutRecords, entityManager, transactionManager);
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EntityScan(basePackageClasses = CheckoutOperationEntity.class)
    @EnableJpaRepositories(basePackageClasses = CheckoutOperationJpaRepository.class)
    static class TransactionPersistenceTestConfiguration {}
}
