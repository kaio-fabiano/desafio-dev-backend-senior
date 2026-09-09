package dev.desafio.transaction.projection;

import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryProjectionRepository;
import dev.desafio.transaction.inventory.application.axon.InventoryCommittedAxonEvent;
import dev.desafio.transaction.inventory.application.axon.InventoryReservedAxonEvent;
import dev.desafio.transaction.inventory.application.event.InventoryProjectionHandler;
import dev.desafio.transaction.inventory.application.query.FindInventoryReservationByTransaction;
import dev.desafio.transaction.inventory.application.query.FindInventoryReservationByTransactionHandler;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.inventory.domain.event.InventoryCommittedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import dev.desafio.transaction.inventory.infrastructure.persistence.JdbcInventoryViewRepository;
import dev.desafio.transaction.payment.adapter.persistence.JdbcPaymentProjection;
import dev.desafio.transaction.payment.application.axon.PaymentProjectionHandler;
import dev.desafio.transaction.payment.application.event.PaymentPending;
import dev.desafio.transaction.payment.application.event.PaymentRequested;
import dev.desafio.transaction.payment.application.query.FindPaymentByTransaction;
import dev.desafio.transaction.payment.application.query.FindPaymentByTransactionHandler;
import dev.desafio.transaction.payment.application.query.PaymentViewRepository;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.payment.infrastructure.persistence.JdbcPaymentViewRepository;
import dev.desafio.transaction.transaction.adapter.persistence.JdbcTransactionViewStore;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.event.TransactionEventHandler;
import dev.desafio.transaction.transaction.application.query.FindCheckoutOperation;
import dev.desafio.transaction.transaction.application.query.FindCheckoutOperationHandler;
import dev.desafio.transaction.transaction.application.query.FindOwnedTransaction;
import dev.desafio.transaction.transaction.application.query.FindOwnedTransactionHandler;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.domain.Transaction;
import dev.desafio.transaction.transaction.infrastructure.persistence.JdbcTransactionReadRepository;
import dev.desafio.transaction.shared.interfaces.graphql.GraphQlReadConfiguration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TransactionProjectionReplayTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static DriverManagerDataSource dataSource;
    private static JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        POSTGRES.start();
        dataSource = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()
        );
        Flyway.configure().dataSource(dataSource).defaultSchema("axon")
            .schemas("axon", "transaction", "inventory", "payment")
            .locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(dataSource);
    }

    @BeforeEach
    void resetViews() {
        jdbc.execute("truncate transaction.transaction_view, transaction.checkout_operation, payment.payment_record cascade");
        jdbc.update("delete from inventory.inventory_operation where state = 'PROJECTION'");
    }

    @AfterAll
    static void stop() {
        POSTGRES.stop();
    }

    @Test
    @DisplayName("Commands, Domain Events, replayable projections, and Axon queries stay distinct @spec:AC-281 @spec:AC-287")
    void onlineAndReplayedViewsAreEqualAndStaleEventsCannotRegressThem() {
        insertCheckout();
        var events = projectHistory();
        var online = snapshot();

        projectStaleEvents(events);
        assertEquals(online, snapshot());

        jdbc.execute("truncate transaction.transaction_view, payment.payment_record cascade");
        jdbc.update("delete from inventory.inventory_operation where state = 'PROJECTION'");
        projectHistory();

        assertEquals(online, snapshot());
        assertEquals("PAYMENT_PENDING", online.transactionStatus());
        assertEquals("COMMITTED", online.inventoryStatus());
        assertEquals("PIX_GENERATED", online.paymentStatus());
        assertEquals("provider-249", online.paymentReference());
        assertEquals("pix-code-249", online.pixCode());
        assertEquals(3, online.version());
        assertEquals("buyer-249", online.owner());
        assertEquals("42", online.wooOrderId());
        assertEquals("COMPLETED", online.checkoutStatus());
    }

    @Test
    @DisplayName("Projection evidence runs on PostgreSQL with no skipped quality gate @spec:AC-292")
    void projectionEvidenceRunsOnPostgres() {
        assertTrue(POSTGRES.getJdbcUrl().startsWith("jdbc:postgresql:"));
        assertEquals(0, jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_schema = 'public'",
            Integer.class
        ));
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource(
                "projection-test",
                Map.of("spring.datasource.url", POSTGRES.getJdbcUrl())
            ));
            context.registerBean(TransactionReadRepository.class,
                () -> new JdbcTransactionReadRepository(dataSource));
            context.registerBean(PaymentViewRepository.class,
                () -> new JdbcPaymentViewRepository(dataSource));
            context.registerBean(InventoryViewRepository.class,
                () -> new JdbcInventoryViewRepository(dataSource));
            context.register(GraphQlReadConfiguration.class);
            context.refresh();

            assertEquals(1, context.getBeansOfType(FindOwnedTransactionHandler.class).size());
            assertEquals(1, context.getBeansOfType(FindPaymentByTransactionHandler.class).size());
            assertEquals(1, context.getBeansOfType(
                FindInventoryReservationByTransactionHandler.class
            ).size());
        }
    }

    private History projectHistory() {
        var started = TransactionEvent.started(new StartTransaction(
            "transaction-249", "operation-249", "buyer-249", "42",
            List.of(new Transaction.Item("1001", 1)), new BigDecimal("19.90"), "BRL", "PIX"
        ), NOW);
        var reservedTransaction = outcome(
            Transaction.Outcome.INVENTORY_RESERVED,
            Transaction.Status.INVENTORY_RESERVED,
            "reservation-249",
            2
        );
        var pendingTransaction = outcome(
            Transaction.Outcome.PAYMENT_PENDING,
            Transaction.Status.PAYMENT_PENDING,
            "provider-249",
            3
        );
        var transactionHandler = new TransactionEventHandler(
            new JdbcTransactionViewStore(dataSource), ignored -> {}
        );
        transactionHandler.on(started);
        transactionHandler.on(reservedTransaction);
        transactionHandler.on(pendingTransaction);

        var reservedInventory = new InventoryReservedAxonEvent(
            "reservation-249",
            new InventoryReservedEvent(
                "reservation-249", "transaction-249", "42",
                List.of(new StockItem("1001", 1)), 1,
                "operation-249", "transaction-249", NOW.plusSeconds(1)
            )
        );
        var committedInventory = new InventoryCommittedAxonEvent(
            "reservation-249",
            new InventoryCommittedEvent(
                "reservation-249", "transaction-249", "42", 2,
                "operation-249", "reservation-249", NOW.plusSeconds(2)
            )
        );
        var inventoryHandler = new InventoryProjectionHandler(
            new JdbcInventoryProjectionRepository(dataSource)
        );
        inventoryHandler.on(reservedInventory);
        inventoryHandler.on(committedInventory);

        var requestedPayment = new PaymentRequested(
            "payment-249", "operation-249", "transaction-249", Payment.Method.PIX,
            new BigDecimal("19.90"), "BRL", null, "buyer@example.test", null,
            "operation-249", "reservation-249", NOW.plusSeconds(2)
        );
        var pendingPayment = new PaymentPending(
            "payment-249", "transaction-249", "provider-249", "pix-code-249",
            "operation-249", "payment-249", NOW.plusSeconds(3)
        );
        var paymentHandler = new PaymentProjectionHandler(new JdbcPaymentProjection(dataSource));
        paymentHandler.on(requestedPayment);
        paymentHandler.on(pendingPayment);

        return new History(reservedTransaction, reservedInventory, requestedPayment);
    }

    private void projectStaleEvents(History events) {
        new TransactionEventHandler(new JdbcTransactionViewStore(dataSource), ignored -> {})
            .on(events.transaction());
        new InventoryProjectionHandler(new JdbcInventoryProjectionRepository(dataSource))
            .on(events.inventory());
        new PaymentProjectionHandler(new JdbcPaymentProjection(dataSource))
            .on(events.payment());
    }

    private Snapshot snapshot() {
        var transactions = new JdbcTransactionReadRepository(dataSource);
        var transaction = new FindOwnedTransactionHandler(transactions)
            .handle(new FindOwnedTransaction("transaction-249", "buyer-249"));
        var checkout = new FindCheckoutOperationHandler(transactions)
            .handle(new FindCheckoutOperation("transaction-249", "buyer-249"));
        var inventory = new FindInventoryReservationByTransactionHandler(
            new JdbcInventoryViewRepository(dataSource)
        ).handle(new FindInventoryReservationByTransaction("transaction-249"));
        var payment = new FindPaymentByTransactionHandler(new JdbcPaymentViewRepository(dataSource))
            .handle(new FindPaymentByTransaction("transaction-249"));
        return new Snapshot(
            checkout.status(), transaction.status().name(), payment.status().name(),
            payment.providerReference(), inventory.status().name(), payment.pixCode(),
            transaction.version(), transaction.owner(), transaction.wooOrderId()
        );
    }

    private void insertCheckout() {
        jdbc.update("""
            insert into transaction.checkout_operation (
                transaction_id, operation_key, subject, command_hash, woo_reference,
                woo_order_id, items, amount, currency, status
            ) values (?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, 'COMPLETED')
            """, "transaction-249", "operation-249", "buyer-249", "a".repeat(64),
            "woo-reference-249", "42", "[]", new BigDecimal("19.90"), "BRL");
    }

    private TransactionEvent outcome(
        Transaction.Outcome outcome,
        Transaction.Status status,
        String reference,
        int version
    ) {
        return TransactionEvent.outcome(
            "transaction-249", "operation-249", "buyer-249", "42",
            List.of(new Transaction.Item("1001", 1)), new BigDecimal("19.90"), "BRL", "PIX",
            outcome, reference, status, version, NOW.plusSeconds(version - 1L)
        );
    }

    private record History(
        TransactionEvent transaction,
        InventoryReservedAxonEvent inventory,
        PaymentRequested payment
    ) {}

    private record Snapshot(
        String checkoutStatus,
        String transactionStatus,
        String paymentStatus,
        String paymentReference,
        String inventoryStatus,
        String pixCode,
        int version,
        String owner,
        String wooOrderId
    ) {}
}
