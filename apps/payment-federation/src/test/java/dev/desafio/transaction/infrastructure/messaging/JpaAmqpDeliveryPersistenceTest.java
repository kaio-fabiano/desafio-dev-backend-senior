package dev.desafio.transaction.infrastructure.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.shared.infrastructure.persistence.InventoryAmqpInboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.InventoryAmqpOutboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaOutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.PaymentAmqpInboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.PaymentAmqpOutboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpInboxEntity;
import dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpInboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpOutboxJpaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JpaAmqpDeliveryPersistenceTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final Instant NOW = Instant.parse("2026-09-10T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static ConfigurableApplicationContext context;

    @BeforeAll
    static void startPostgres() {
        POSTGRES.start();
        context = persistenceContext();
    }

    @AfterAll
    static void stopPostgres() {
        if (context != null) context.close();
        POSTGRES.stop();
    }

    @Test
    @DisplayName("Concurrent inbox and outbox claims remain deduplicated and non-blocking @spec:AC-302")
    void concurrentClaimsRemainDeduplicatedAndRecoverable() throws Exception {
        var json = context.getBean(ObjectMapper.class);
        var entityManager = context.getBean(EntityManager.class);
        var transactions = context.getBean(PlatformTransactionManager.class);
        var inbox = JpaInboxStore.inventory(
            context.getBean(InventoryAmqpInboxJpaRepository.class),
            entityManager,
            json,
            CLOCK,
            transactions
        );
        var event = event("inbox-302");
        var handlerEntered = new CountDownLatch(1);
        var releaseHandler = new CountDownLatch(1);
        var deliveries = new AtomicInteger();

        var first = CompletableFuture.supplyAsync(() -> inbox.processOnce(
            "inventory",
            event,
            ignored -> {
                handlerEntered.countDown();
                await(releaseHandler);
                deliveries.incrementAndGet();
                return JpaInboxStore.Disposition.COMPLETED;
            }
        ));
        assertTrue(handlerEntered.await(5, TimeUnit.SECONDS));
        var duplicate = CompletableFuture.supplyAsync(() -> inbox.processOnce(
            "inventory",
            event,
            ignored -> {
                deliveries.incrementAndGet();
                return JpaInboxStore.Disposition.COMPLETED;
            }
        ));
        try {
            assertFalse(duplicate.get(2, TimeUnit.SECONDS));
        } finally {
            releaseHandler.countDown();
        }
        assertTrue(first.get(5, TimeUnit.SECONDS));
        assertEquals(1, deliveries.get());
        assertEquals("COMPLETED", inbox.disposition("inventory", event.eventId()));

        var retry = event("retry-302");
        assertThrows(IllegalStateException.class, () -> inbox.processOnce(
            "inventory", retry, ignored -> { throw new IllegalStateException("retry"); }
        ));
        assertTrue(inbox.processOnce(
            "inventory", retry, ignored -> JpaInboxStore.Disposition.COMPLETED
        ));
        assertThrows(IllegalArgumentException.class, () -> inbox.processOnce(
            "inventory",
            changed(event),
            ignored -> JpaInboxStore.Disposition.COMPLETED
        ));

        var transactionRecords = context.getBean(TransactionAmqpOutboxJpaRepository.class);
        var outbox = JpaOutboxStore.transaction(
            transactionRecords, entityManager, json, transactions
        );
        var outgoing = event("outbox-302");
        outbox.enqueue("source-302", outgoing);
        outbox.enqueue("source-302", outgoing);
        assertThrows(IllegalArgumentException.class, () ->
            outbox.enqueue("source-302", changed(outgoing))
        );

        var claimed = outbox.claim(10, "relay-a", NOW, Duration.ofMinutes(1));
        assertEquals(1, claimed.size());
        assertTrue(outbox.claim(10, "relay-b", NOW, Duration.ofMinutes(1)).isEmpty());
        outbox.release(outgoing.eventId(), "relay-b", new IllegalStateException("not owner"));
        assertThrows(IllegalStateException.class, () ->
            outbox.markPublished(outgoing.eventId(), "relay-b", NOW)
        );
        outbox.release(outgoing.eventId(), "relay-a", new IllegalStateException("broker down"));

        assertEquals(1, outbox.claim(10, "relay-b", NOW, Duration.ofMinutes(1)).size());
        entityManager.clear();
        assertEquals(
            2,
            transactionRecords.findById(outgoing.eventId()).orElseThrow().publicationAttempts()
        );
        outbox.markPublished(outgoing.eventId(), "relay-b", NOW.plusSeconds(1));
        assertEquals(0, outbox.pendingCount());

        var inventoryOutbox = JpaOutboxStore.inventory(
            context.getBean(InventoryAmqpOutboxJpaRepository.class),
            entityManager,
            json,
            transactions
        );
        var paymentOutbox = JpaOutboxStore.payment(
            context.getBean(PaymentAmqpOutboxJpaRepository.class),
            entityManager,
            json,
            transactions
        );
        inventoryOutbox.enqueue("shared-source-302", event("inventory-owner-302"));
        paymentOutbox.enqueue("shared-source-302", event("payment-owner-302"));
        assertEquals(1, inventoryOutbox.pendingCount());
        assertEquals(1, paymentOutbox.pendingCount());
    }

    @Test
    @DisplayName("Flyway schema validates every shared AMQP JPA mapping across restart @spec:AC-304 @spec:AC-298")
    void flywaySchemaValidatesEveryFixedSchemaEntityAcrossRestart() {
        assertNotNull(context.getBean(TransactionAmqpInboxJpaRepository.class));
        assertNotNull(context.getBean(InventoryAmqpInboxJpaRepository.class));
        assertNotNull(context.getBean(PaymentAmqpInboxJpaRepository.class));
        assertNotNull(context.getBean(TransactionAmqpOutboxJpaRepository.class));
        assertNotNull(context.getBean(InventoryAmqpOutboxJpaRepository.class));
        assertNotNull(context.getBean(PaymentAmqpOutboxJpaRepository.class));
        try (var restarted = persistenceContext()) {
            assertNotNull(restarted.getBean(EntityManagerFactory.class));
        }
    }

    private static ConfigurableApplicationContext persistenceContext() {
        return new SpringApplicationBuilder(SharedAmqpJpaTestApplication.class)
            .web(WebApplicationType.NONE)
            .properties(
                "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "spring.datasource.username=" + POSTGRES.getUsername(),
                "spring.datasource.password=" + POSTGRES.getPassword(),
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.jpa.open-in-view=false",
                "spring.flyway.enabled=true",
                "spring.flyway.create-schemas=true",
                "spring.flyway.default-schema=axon",
                "spring.flyway.schemas=axon,transaction,inventory,payment",
                "management.health.rabbit.enabled=false"
            )
            .run();
    }

    private static IntegrationEventEnvelope<JsonNode> event(String source) {
        return new IntegrationEventEnvelope<>(
            UUID.nameUUIDFromBytes(source.getBytes(StandardCharsets.UTF_8)),
            "transaction.order-received.v1",
            1,
            "aggregate-" + source,
            "transaction-" + source,
            "correlation-" + source,
            "causation-" + source,
            NOW,
            new ObjectMapper().valueToTree(Map.of("source", source))
        );
    }

    private static IntegrationEventEnvelope<JsonNode> changed(
        IntegrationEventEnvelope<JsonNode> event
    ) {
        return new IntegrationEventEnvelope<>(
            event.eventId(), event.eventType(), event.version(), "different-aggregate",
            event.transactionId(), event.correlationId(), event.causationId(), event.occurredAt(),
            event.payload()
        );
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("timed out waiting for concurrent claim");
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(error);
        }
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({
        DataSourceAutoConfiguration.class,
        FlywayAutoConfiguration.class,
        HibernateJpaAutoConfiguration.class,
        TransactionAutoConfiguration.class,
        JacksonAutoConfiguration.class
    })
    @EntityScan(basePackageClasses = TransactionAmqpInboxEntity.class)
    @EnableJpaRepositories(basePackageClasses = TransactionAmqpInboxJpaRepository.class)
    static class SharedAmqpJpaTestApplication {}
}
