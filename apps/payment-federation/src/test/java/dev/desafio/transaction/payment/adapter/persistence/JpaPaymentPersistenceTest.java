package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.domain.event.PaymentRequested;
import dev.desafio.transaction.payment.application.query.PaymentViewRepository;
import dev.desafio.transaction.payment.domain.Payment;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JpaPaymentPersistenceTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final Instant NOW = Instant.parse("2026-09-10T12:00:00Z");
    private static ConfigurableApplicationContext context;

    @BeforeAll
    static void startPostgres() {
        POSTGRES.start();
        context = persistenceContext();
    }

    @AfterAll
    static void stopPostgres() {
        context.close();
        POSTGRES.stop();
    }

    @Test
    @DisplayName("Payment JPA adapters preserve reloaded state and financial idempotency @spec:AC-300")
    void adaptersRoundTripAndRejectIdentifierCollisions() {
        var repository = context.getBean(PaymentRepository.class);
        var effects = context.getBean(PaymentEffectLedger.class);
        var entityManager = context.getBean(EntityManager.class);
        var eventId = UUID.randomUUID();
        var request = request("direct");
        var approved = new PaymentProvider.Result(
            "provider-direct", Payment.Status.AUTHORIZED, null
        );

        var first = repository.process(eventId, request, approved, NOW);
        entityManager.clear();
        var duplicate = repository.processed(eventId, request).orElseThrow();

        assertEquals(first.payment(), duplicate.payment());
        assertEquals(first.outgoingEvent(), duplicate.outgoingEvent());
        assertEquals(true, duplicate.duplicateDelivery());
        assertThrows(IllegalArgumentException.class, () -> repository.process(
            UUID.randomUUID(), request("collision", request.paymentId()),
            new PaymentProvider.Result("provider-collision", Payment.Status.AUTHORIZED, null), NOW
        ));

        var effect = new PaymentEffectLedger.Effect(
            UUID.randomUUID(), "payment-effect", "operation-effect",
            PaymentEffectLedger.Type.PROVIDER_PAYMENT, NOW
        );
        var claims = List.of(
            CompletableFuture.supplyAsync(() -> effects.claim(effect)),
            CompletableFuture.supplyAsync(() -> effects.claim(effect))
        ).stream().map(CompletableFuture::join).toList();
        assertEquals(1, claims.stream().filter(Boolean::booleanValue).count());

        effects.complete(effect.effectId(), approved, NOW.plusSeconds(1));
        entityManager.clear();
        assertEquals(approved, effects.completed(effect.effectId()).orElseThrow());

        var pending = request("notification");
        repository.process(
            UUID.randomUUID(), pending,
            new PaymentProvider.Result("provider-notification", Payment.Status.PENDING, null), NOW
        );
        var notifications = context.getBean(ProviderNotificationHandler.Repository.class);
        var authoritative = new PaymentProvider.Result(
            "provider-notification", Payment.Status.AUTHORIZED, null
        );
        assertEquals(
            ProviderNotificationHandler.Outcome.APPLIED,
            notifications.apply("provider-request-300", authoritative, NOW.plusSeconds(2))
        );
        entityManager.clear();
        assertEquals(
            ProviderNotificationHandler.Outcome.DUPLICATE,
            notifications.apply("provider-request-300", authoritative, NOW.plusSeconds(3))
        );
    }

    @Test
    @DisplayName("Payment transaction and external order references remain distinct @spec:AC-300")
    void projectionQueriesUseTheTransactionReference() {
        var projection = context.getBean(PaymentProjection.class);
        var views = context.getBean(PaymentViewRepository.class);
        var entityManager = context.getBean(EntityManager.class);
        projection.project(new PaymentRequested(
            "payment-projection", "operation-projection", "transaction-300",
            Payment.Method.CARD, new BigDecimal("19.90"), "BRL", "token",
            "buyer@example.test", "visa", "correlation-300", "causation-300", NOW
        ));

        entityManager.clear();
        var view = views.findByTransactionId("transaction-300").orElseThrow();

        assertEquals("payment-projection", view.id());
        assertNull(view.orderId());
    }

    @Test
    @DisplayName("Flyway schema validates all Payment JPA mappings across restart @spec:AC-304")
    void flywaySchemaValidatesJpaMappingsAcrossRestart() {
        assertNotNull(context.getBean(jakarta.persistence.EntityManagerFactory.class));
        try (var restarted = persistenceContext()) {
            assertNotNull(restarted.getBean(jakarta.persistence.EntityManagerFactory.class));
        }
    }

    private static org.springframework.context.ConfigurableApplicationContext persistenceContext() {
        return new SpringApplicationBuilder(PaymentJpaTestApplication.class)
            .web(WebApplicationType.NONE)
            .properties(
                "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "spring.datasource.username=" + POSTGRES.getUsername(),
                "spring.datasource.password=" + POSTGRES.getPassword(),
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.flyway.enabled=true",
                "spring.flyway.create-schemas=true",
                "spring.flyway.default-schema=axon",
                "spring.flyway.schemas=axon,transaction,inventory,payment",
                "management.health.rabbit.enabled=false"
            )
            .run();
    }

    private static Payment.PaymentRequested request(String suffix) {
        return request(suffix, "payment-" + suffix);
    }

    private static Payment.PaymentRequested request(String suffix, String paymentId) {
        return new Payment.PaymentRequested(
            "operation-" + suffix, paymentId, "order-" + suffix, Payment.Method.CARD,
            new BigDecimal("42.50"), "BRL", "provider-token", "buyer@example.test", "visa"
        );
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({
        DataSourceAutoConfiguration.class,
        FlywayAutoConfiguration.class,
        HibernateJpaAutoConfiguration.class,
        TransactionAutoConfiguration.class
    })
    @EntityScan(basePackageClasses = PaymentRecordEntity.class)
    @EnableJpaRepositories(basePackageClasses = SpringDataPaymentRecordRepository.class)
    static class PaymentJpaTestApplication {
        @Bean
        PaymentRepository paymentRepository(
            SpringDataPaymentRecordRepository payments,
            SpringDataPaymentEffectRepository effects,
            SpringDataPaymentInboxRepository inbox,
            SpringDataPaymentOutboxRepository outbox
        ) {
            return new JpaPaymentRepository(payments, effects, inbox, outbox);
        }

        @Bean
        PaymentEffectLedger paymentEffectLedger(
            SpringDataPaymentEffectRepository effects,
            PlatformTransactionManager transactions
        ) {
            return new JpaPaymentEffectLedger(effects, transactions);
        }

        @Bean
        PaymentProjection paymentProjection(SpringDataPaymentRecordRepository payments) {
            return new JpaPaymentProjection(payments);
        }

        @Bean
        PaymentViewRepository paymentViews(SpringDataPaymentRecordRepository payments) {
            return new JpaPaymentViewRepository(payments);
        }

        @Bean
        ProviderNotificationHandler.Repository providerNotifications(
            SpringDataProviderNotificationRepository notifications,
            SpringDataPaymentRecordRepository payments,
            SpringDataPaymentEffectRepository effects,
            SpringDataPaymentOutboxRepository outbox
        ) {
            return new JpaProviderNotificationRepository(notifications, payments, effects, outbox);
        }
    }
}
