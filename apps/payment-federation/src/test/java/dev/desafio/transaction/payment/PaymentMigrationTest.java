package dev.desafio.transaction.payment;

import dev.desafio.transaction.PaymentFederationApplication;
import dev.desafio.transaction.payment.adapter.provider.DeterministicPaymentProvider;
import dev.desafio.transaction.payment.application.PaymentHandler;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentMigrationTest {
    private static final Path PAYMENT_ROOT = Path.of(
        "src/main/java/dev/desafio/transaction/payment"
    );

    @Test
    @DisplayName("AC-170: canonical Payment layers depend inward and Spring composes at the boundary @spec:AC-170")
    void canonicalPaymentLayersDependInward() throws Exception {
        var sources = sources();
        assertTrue(sources.stream().anyMatch(path -> path.toString().contains("/domain/")));
        assertTrue(sources.stream().anyMatch(path -> path.toString().contains("/application/")));
        assertTrue(sources.stream().anyMatch(path -> path.toString().contains("/adapter/")));
        assertTrue(sources.stream().anyMatch(path -> path.toString().contains("/configuration/")));

        for (var path : sources) {
            var normalized = path.toString().replace('\\', '/');
            var source = Files.readString(path);
            if (normalized.contains("/domain/")) {
                assertFalse(source.matches(
                    "(?s).*import (org\\.springframework|com\\.mercadopago|com\\.rabbitmq|java\\.sql).*"
                ));
            }
            if (normalized.contains("/application/")) {
                assertFalse(source.matches(
                    "(?s).*import (org\\.springframework|com\\.mercadopago|dev\\.desafio\\.transaction\\.payment\\.adapter).*"
                ));
            }
        }
    }

    @Test
    @DisplayName("AC-171: canonical Payment has no legacy dependency or compatibility implementation @spec:AC-171")
    void canonicalPaymentIsIndependentFromLegacyPackages() throws Exception {
        var sources = sources();
        assertEquals(1, sources.stream().filter(path -> path.endsWith("domain/Payment.java")).count());
        for (var path : sources) {
            var source = Files.readString(path);
            assertFalse(source.contains("dev.desafio.payment"), path.toString());
            assertFalse(source.matches("(?s).*class\\s+(Legacy|Compatibility).*"), path.toString());
        }
    }

    @Test
    @DisplayName("AC-172: migrated Payment runtime executes Card and Pix behavior from provider results @spec:AC-172")
    void migratedPaymentRuntimeRemainsExecutable() throws Exception {
        var handler = new PaymentHandler(new InMemoryRepository(), new DeterministicPaymentProvider());
        var card = handler.handle(UUID.randomUUID(), request(Payment.Method.CARD));
        var pix = handler.handle(UUID.randomUUID(), request(Payment.Method.PIX));

        assertEquals(Payment.Status.AUTHORIZED, card.payment().status());
        assertEquals(card.payment().providerReference(), card.outgoingEvent().payload().get("providerReference"));
        assertEquals(Payment.Status.PIX_GENERATED, pix.payment().status());
        assertEquals(pix.payment().pixCode(), pix.outgoingEvent().payload().get("pixCode"));
        var lifecycleMigration = Files.readString(Path.of(
            "src/main/resources/db/migration/V3__mercado_pago_payment_lifecycle.sql"
        ));
        var notificationMigration = Files.readString(Path.of(
            "src/main/resources/db/migration/V4__provider_notification_inbox.sql"
        ));
        assertTrue(lifecycleMigration.contains("provider_reference"));
        assertTrue(lifecycleMigration.contains("PAYMENT_REJECTION"));
        assertTrue(notificationMigration.contains("provider_request_id text primary key"));
        assertNotNull(PaymentFederationApplication.class.getDeclaredMethod("main", String[].class));
        try (var context = new SpringApplicationBuilder(PaymentFederationApplication.class)
            .web(WebApplicationType.NONE)
            .profiles("test")
            .properties(
                "spring.autoconfigure.exclude="
                    + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
                "management.health.rabbit.enabled=false"
            )
            .run()) {
            assertTrue(context.isActive());
        }
        try (var context = new SpringApplicationBuilder(PaymentFederationApplication.class)
            .web(WebApplicationType.NONE)
            .profiles("test")
            .properties(
                "spring.datasource.url=jdbc:h2:mem:canonical-payment;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "spring.flyway.enabled=false",
                "spring.rabbitmq.listener.simple.auto-startup=false",
                "management.health.rabbit.enabled=false",
                "payment.provider.mode=deterministic"
            )
            .run()) {
            assertNotNull(context.getBean(PaymentHandler.class));
            assertNotNull(context.getBean(PaymentRepository.class));
        }
    }

    private Payment.PaymentRequested request(Payment.Method method) {
        var suffix = method.name().toLowerCase(java.util.Locale.ROOT);
        return new Payment.PaymentRequested(
            "operation-" + suffix,
            "payment-" + suffix,
            "order-" + suffix,
            method,
            new BigDecimal("42.50"),
            "BRL",
            method == Payment.Method.CARD ? "provider-token" : null,
            "buyer@example.test",
            method == Payment.Method.CARD ? "visa" : null
        );
    }

    private ArrayList<Path> sources() throws Exception {
        var sources = new ArrayList<Path>();
        try (var paths = Files.walk(PAYMENT_ROOT)) {
            paths.filter(path -> path.toString().endsWith(".java")).forEach(sources::add);
        }
        return sources;
    }

    private static final class InMemoryRepository implements PaymentRepository {
        @Override
        public String providerReference(Payment.RefundRequested command) {
            return "deterministic:" + command.operationKey();
        }

        @Override
        public ProcessingResult process(
            UUID incomingEventId,
            Payment.Command command,
            PaymentProvider.Result providerResult,
            Instant occurredAt
        ) {
            var payment = Payment.fromProvider(
                (Payment.PaymentRequested) command,
                providerResult.toDomainResult()
            );
            return new ProcessingResult(payment, Payment.resultEvent(payment, occurredAt), false);
        }
    }
}
