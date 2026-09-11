package dev.desafio.transaction.e2e;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.configuration.AmqpTopologyConfiguration;
import dev.desafio.transaction.configuration.MarketplaceAmqp;
import dev.desafio.transaction.inventory.adapter.messaging.AxonInventoryRabbitListener;
import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.application.event.InventoryAxonEvents;
import dev.desafio.transaction.inventory.domain.event.InventoryCommitRejectedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReleasedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservationRejectedAxonEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedAxonEvent;
import dev.desafio.transaction.inventory.application.command.CommitInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReleaseInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommand;
import dev.desafio.transaction.inventory.application.event.InventoryIntegrationEventHandler;
import dev.desafio.transaction.inventory.application.event.InventoryOutbox;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservationRejectedEvent;
import dev.desafio.transaction.payment.application.event.PaymentProviderEffectHandler;
import dev.desafio.transaction.payment.adapter.messaging.AxonPaymentRabbitListener;
import dev.desafio.transaction.payment.adapter.persistence.JpaPaymentEffectLedger;
import dev.desafio.transaction.payment.adapter.persistence.JpaPaymentProjection;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentEffectRepository;
import dev.desafio.transaction.payment.adapter.persistence.SpringDataPaymentRecordRepository;
import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.axon.PaymentAggregate;
import dev.desafio.transaction.payment.application.command.RequestPayment;
import dev.desafio.transaction.payment.application.command.RecordPaymentOutcome;
import dev.desafio.transaction.payment.application.command.RefundPayment;
import dev.desafio.transaction.payment.application.event.PaymentIntegrationEventHandler;
import dev.desafio.transaction.payment.domain.event.PaymentApproved;
import dev.desafio.transaction.payment.domain.event.PaymentRequested;
import dev.desafio.transaction.payment.domain.event.PaymentRejected;
import dev.desafio.transaction.payment.application.event.PaymentProjectionHandler;
import dev.desafio.transaction.payment.adapter.messaging.OutboxPaymentIntegrationEventPublisher;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.ConfirmedAmqpPublisher;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelay;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.InboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaOutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.OutboxStore;
import dev.desafio.transaction.transaction.adapter.persistence.JpaTransactionOutbox;
import dev.desafio.transaction.transaction.adapter.messaging.TransactionRabbitListener;
import dev.desafio.transaction.transaction.adapter.persistence.JpaTransactionViewStore;
import dev.desafio.transaction.transaction.adapter.persistence.TransactionOutboxJpaRepository;
import dev.desafio.transaction.transaction.adapter.persistence.TransactionViewJpaRepository;
import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcome;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import dev.desafio.transaction.transaction.domain.Transaction;
import jakarta.persistence.EntityManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Exchange;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.awaitility.Awaitility.await;
import java.time.Duration;

class ChoreographedLifecycleE2ETest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final GenericContainer<?> RABBIT =
        new GenericContainer<>("rabbitmq:4.1.3-management-alpine").withExposedPorts(5672);
    private static final Clock CLOCK = Clock.fixed(
        Instant.parse("2026-09-09T12:00:00Z"), ZoneOffset.UTC
    );

    private static DataSource dataSource;
    private static ObjectMapper json;
    private static CachingConnectionFactory connectionFactory;
    private static RabbitTemplate rabbit;
    private static ConfigurableApplicationContext persistence;

    @BeforeAll
    static void startInfrastructure() {
        POSTGRES.start();
        RABBIT.start();
        var source = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()
        );
        dataSource = source;
        Flyway.configure().dataSource(dataSource).defaultSchema("axon")
            .schemas("axon", "transaction", "inventory", "payment")
            .locations("classpath:db/migration").load().migrate();
        persistence = persistenceContext();
        json = new ObjectMapper().findAndRegisterModules();
        connectionFactory = new CachingConnectionFactory("localhost", RABBIT.getMappedPort(5672));
        connectionFactory.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.CORRELATED);
        connectionFactory.setPublisherReturns(true);
        rabbit = new RabbitTemplate(connectionFactory);
        rabbit.setMandatory(true);
        var admin = new RabbitAdmin(connectionFactory);
        var topology = new AmqpTopologyConfiguration().marketplaceAmqpTopology();
        topology.getDeclarablesByType(Exchange.class).forEach(admin::declareExchange);
        topology.getDeclarablesByType(Queue.class).forEach(admin::declareQueue);
        topology.getDeclarablesByType(Binding.class).forEach(admin::declareBinding);
    }

    @BeforeEach
    void resetInfrastructure() {
        var admin = new RabbitAdmin(connectionFactory);
        for (var context : List.of("transaction", "inventory", "payment")) {
            admin.purgeQueue(MarketplaceAmqp.eventQueue(context), true);
        }
        var jdbc = new JdbcTemplate(dataSource);
        for (var schema : List.of("transaction", "inventory", "payment")) {
            jdbc.execute("truncate " + schema + ".amqp_inbox, " + schema + ".amqp_outbox");
        }
        jdbc.execute("truncate transaction.transaction_view, payment.payment_record, payment.payment_effect cascade");
        jdbc.update("delete from inventory.inventory_operation where state = 'PROJECTION'");
    }

    @AfterAll
    static void stopInfrastructure() {
        if (connectionFactory != null) connectionFactory.destroy();
        if (persistence != null) persistence.close();
        RABBIT.stop();
        POSTGRES.stop();
    }

    @Test
    @DisplayName("RabbitMQ lifecycle preserves tokenized Card credentials and operation keys @spec:AC-286 @spec:AC-287 @spec:AC-293 @spec:AC-314 @spec:AC-315")
    void inventoryFirstEventsReachPaymentOnlyThroughRabbitMqWithCausalMetadata() throws Exception {
        var started = StartTransaction.started(new StartTransaction(
            "transaction-251", "operation-251", "buyer@example.test", "order-251",
            List.of(new Transaction.Item("sku-251", 1)), new BigDecimal("42.50"), "BRL", "CARD",
            "provider-token-251", "visa"
        ), CLOCK.instant());
        transactionOutbox().enqueueOrderReceived(started);
        var transaction = new AtomicReference<>(Transaction.replay(List.of(started.toDomainEvent())));
        var transactionViews = transactionViews();
        transactionViews.upsert(started);
        relay("transaction");

        var inventoryCommands = mock(org.axonframework.messaging.commandhandling.gateway.CommandGateway.class);
        var reservation = new AtomicReference<InventoryReservation>();
        when(inventoryCommands.send(any(), eq(Object.class))).thenAnswer(invocation -> {
            var command = invocation.getArgument(0);
            var integration = new InventoryIntegrationEventHandler(inventoryOutbox());
            if (command instanceof ReserveInventoryCommand reserve) {
                assertEquals("inventory:transaction-251", reserve.inventoryReservationId());
                assertEquals("payment:transaction-251", reserve.paymentId());
                var reserved = new InventoryReservedEvent(
                    reserve.inventoryReservationId(), reserve.transactionId(), reserve.orderId(),
                    reserve.items(), reserve.paymentId(), reserve.paymentOperationKey(),
                    reserve.paymentMethod(), reserve.providerToken(), reserve.paymentMethodId(),
                    reserve.amount(), reserve.currency(), reserve.payerEmail(), 1,
                    reserve.correlationId(), reserve.causationId(), CLOCK.instant()
                );
                reservation.set(new InventoryReservation(reserved));
                integration.on(new InventoryReservedAxonEvent(reserve.inventoryReservationId(), reserved));
                return CompletableFuture.completedFuture(InventoryReservation.Status.RESERVED);
            }
            var commit = (CommitInventoryCommand) command;
            assertEquals("inventory:transaction-251", commit.inventoryReservationId());
            reservation.get().commit(
                commit.correlationId(), commit.causationId(), CLOCK.instant(),
                event -> dispatchInventory(integration, InventoryAxonEvents.wrap(event))
            );
            return CompletableFuture.completedFuture(reservation.get().status());
        });
        var inventoryConsumer = reliable("inventory");
        var inventory = new AxonInventoryRabbitListener(
            inventoryConsumer, inventoryCommands, legacyInventory(), rabbit, json
        );
        consume(MarketplaceAmqp.eventQueue("inventory"), inventory::receive);
        relay("inventory");

        var requested = new AtomicReference<RequestPayment>();
        var paymentCommands = mock(org.axonframework.messaging.commandhandling.gateway.CommandGateway.class);
        when(paymentCommands.send(any(), eq(String.class))).thenAnswer(invocation -> {
            requested.set((RequestPayment) invocation.getArgument(0));
            return CompletableFuture.completedFuture("payment-251");
        });
        var paymentConsumer = reliable("payment");
        var payment = new AxonPaymentRabbitListener(paymentConsumer, paymentCommands);
        consume(MarketplaceAmqp.eventQueue("payment"), payment::receive);

        assertNotNull(requested.get());
        assertEquals("transaction-251", requested.get().transactionId());
        assertEquals("operation-251", requested.get().correlationId());
        assertEquals("operation-251:payment", requested.get().operationKey());
        assertEquals("CARD", requested.get().method().name());
        assertEquals("provider-token-251", requested.get().providerToken());
        assertEquals("visa", requested.get().paymentMethodId());

        new PaymentIntegrationEventHandler(paymentPublisher()).on(new PaymentApproved(
            requested.get().paymentId(), requested.get().transactionId(), "provider-251",
            requested.get().correlationId(), requested.get().causationId(), CLOCK.instant()
        ));
        relay("payment");

        var transactionListener = transactionListener(transaction, transactionViews);
        consume(MarketplaceAmqp.eventQueue("transaction"), transactionListener::receive);
        consume(MarketplaceAmqp.eventQueue("transaction"), transactionListener::receive);
        consume(MarketplaceAmqp.eventQueue("inventory"), inventory::receive);
        relay("inventory");
        consume(MarketplaceAmqp.eventQueue("transaction"), transactionListener::receive);

        assertEquals(Transaction.Status.COMPLETED, transaction.get().status());
        assertEquals(Transaction.Status.COMPLETED,
            transactionViews.find("transaction-251").orElseThrow().status());
        assertEquals(4, transactionViews.find("transaction-251").orElseThrow().version());
    }

    @Test
    @DisplayName("Commit rejection triggers one provider refund and converges without regression @spec:AC-283 @spec:AC-284 @spec:AC-286 @spec:AC-287")
    void commitRejectionTriggersOneProviderRefundAndConvergesWithoutRegression() throws Exception {
        var started = StartTransaction.started(new StartTransaction(
            "transaction-refund", "operation-refund", "buyer@example.test", "order-refund",
            List.of(new Transaction.Item("sku-refund", 1)), new BigDecimal("42.50"), "BRL", "CARD",
            "provider-token-refund", "visa"
        ), CLOCK.instant());
        var transaction = Transaction.replay(List.of(started.toDomainEvent()));
        apply(transaction, Transaction.Outcome.INVENTORY_RESERVED, "reservation-refund");
        apply(transaction, Transaction.Outcome.PAYMENT_APPROVED, "provider-refund");
        var transactionRef = new AtomicReference<>(transaction);
        var views = transactionViews();
        views.upsert(started);

        var reserved = new InventoryReservedEvent(
            "transaction-refund", "transaction-refund", "order-refund",
            List.of(new dev.desafio.transaction.inventory.domain.StockItem("sku-refund", 1)),
            "transaction-refund", "operation-refund:payment", "CARD", "provider-token-refund", "visa",
            new BigDecimal("42.50"), "BRL", "buyer@example.test", 1,
            "operation-refund", started.eventId().toString(), CLOCK.instant()
        );
        var reservation = new InventoryReservation(reserved);
        var events = new ArrayList<Object>();
        assertTrue(reservation.rejectCommit(
            "STOCK_COMMIT_REJECTED", "operation-refund", "payment-approved", CLOCK.instant(), events::add
        ));
        var rejected = (InventoryCommitRejectedAxonEvent) InventoryAxonEvents.wrap(events.getFirst());
        new InventoryIntegrationEventHandler(inventoryOutbox()).on(rejected);
        relay("inventory");
        duplicatePublished("inventory", "inventory.commit-rejected.v1");

        var transactionListener = transactionListener(transactionRef, views);
        consume(MarketplaceAmqp.eventQueue("transaction"), transactionListener::receive);
        consume(MarketplaceAmqp.eventQueue("transaction"), transactionListener::receive);
        assertEquals(Transaction.Status.REFUND_PENDING, transactionRef.get().status());

        var refund = new AtomicReference<RefundPayment>();
        var refundCommands = new AtomicInteger();
        var paymentGateway = mock(org.axonframework.messaging.commandhandling.gateway.CommandGateway.class);
        when(paymentGateway.send(any(), eq(String.class))).thenAnswer(invocation -> {
            refund.set((RefundPayment) invocation.getArgument(0));
            refundCommands.incrementAndGet();
            return CompletableFuture.completedFuture("transaction-refund");
        });
        var paymentListener = new AxonPaymentRabbitListener(
            reliable("payment"), paymentGateway
        );
        consume(MarketplaceAmqp.eventQueue("payment"), paymentListener::receive);
        consume(MarketplaceAmqp.eventQueue("payment"), paymentListener::receive);
        assertEquals(1, refundCommands.get());

        var requested = new PaymentRequested(
            "transaction-refund", "operation-refund:payment", "transaction-refund",
            dev.desafio.transaction.payment.domain.Payment.Method.CARD, new BigDecimal("42.50"),
            "BRL", "opaque-test-reference", "buyer@example.test", "visa",
            "operation-refund", "inventory-reserved", CLOCK.instant()
        );
        var approved = new PaymentApproved(
            requested.paymentId(), requested.transactionId(), "provider-refund",
            requested.correlationId(), requested.causationId(), CLOCK.instant()
        );
        var aggregate = new PaymentAggregate(requested);
        aggregate.on(approved);
        var refundRequested = aggregate.refund(refund.get(), CLOCK.instant());
        aggregate.on(refundRequested);
        var projection = new PaymentProjectionHandler(paymentProjection());
        projection.on(requested);
        projection.on(approved);
        assertEquals(PaymentAggregate.Stage.REFUND_PENDING, aggregate.stage());

        var providerCalls = new AtomicInteger();
        PaymentProvider provider = command -> {
            providerCalls.incrementAndGet();
            return new PaymentProvider.Result("provider-refund",
                dev.desafio.transaction.payment.domain.Payment.Status.REFUNDED, null);
        };
        var outcome = new AtomicReference<RecordPaymentOutcome>();
        var outcomeGateway = mock(org.axonframework.messaging.commandhandling.gateway.CommandGateway.class);
        when(outcomeGateway.send(any(), eq(Void.class))).thenAnswer(invocation -> {
            outcome.set((RecordPaymentOutcome) invocation.getArgument(0));
            return CompletableFuture.completedFuture(null);
        });
        var effects = new PaymentProviderEffectHandler(
            paymentEffects(), provider, outcomeGateway, CLOCK
        );
        effects.execute(refundRequested).join();
        effects.execute(refundRequested).join();
        assertEquals(1, providerCalls.get());

        var refunded = (dev.desafio.transaction.payment.domain.event.PaymentRefunded)
            aggregate.record(outcome.get(), CLOCK.instant());
        aggregate.on(refunded);
        projection.on(refunded);
        new PaymentIntegrationEventHandler(paymentPublisher()).on(refunded);
        relay("payment");
        consume(MarketplaceAmqp.eventQueue("transaction"), transactionListener::receive);

        assertEquals(PaymentAggregate.Stage.REFUNDED, aggregate.stage());
        assertEquals(Transaction.Status.REFUNDED, transactionRef.get().status());
        assertEquals("REFUNDED", new JdbcTemplate(dataSource).queryForObject(
            "select status from payment.payment_record where payment_id = ?",
            String.class, requested.paymentId()
        ));
    }

    @Test
    @DisplayName("Inventory and Payment rejection reactions remain independent over RabbitMQ @spec:AC-283 @spec:AC-284 @spec:AC-286 @spec:AC-293")
    void inventoryAndPaymentRejectionsRemainIndependentOverRabbitMq() throws Exception {
        var firstStarted = StartTransaction.started(new StartTransaction(
            "transaction-no-stock", "operation-no-stock", "buyer@example.test", "order-no-stock",
            List.of(new Transaction.Item("sku-empty", 1)), new BigDecimal("10.00"), "BRL", "PIX", null, null
        ), CLOCK.instant());
        var noStockTransaction = new AtomicReference<>(Transaction.replay(List.of(firstStarted.toDomainEvent())));
        var noStockViews = transactionViews();
        noStockViews.upsert(firstStarted);
        var rejectedReservation = new InventoryReservationRejectedEvent(
            "transaction-no-stock", "transaction-no-stock", "order-no-stock",
            List.of(new dev.desafio.transaction.inventory.domain.StockItem("sku-empty", 1)),
            "INSUFFICIENT_STOCK", 1, "operation-no-stock", firstStarted.eventId().toString(), CLOCK.instant()
        );
        var inventoryEvents = new InventoryIntegrationEventHandler(inventoryOutbox());
        inventoryEvents.on(new InventoryReservationRejectedAxonEvent(
            "transaction-no-stock", rejectedReservation
        ));
        relay("inventory");
        var noStockListener = transactionListener(noStockTransaction, noStockViews);
        consume(MarketplaceAmqp.eventQueue("transaction"), noStockListener::receive);

        assertEquals(Transaction.Status.REJECTED, noStockTransaction.get().status());
        assertQueueEmpty(MarketplaceAmqp.eventQueue("payment"));

        var secondStarted = StartTransaction.started(new StartTransaction(
            "transaction-payment-rejected", "operation-payment-rejected", "buyer@example.test",
            "order-payment-rejected", List.of(new Transaction.Item("sku-available", 1)),
            new BigDecimal("10.00"), "BRL", "CARD", "provider-token-rejected", "master"
        ), CLOCK.instant());
        var paymentRejectedTransaction = Transaction.replay(List.of(secondStarted.toDomainEvent()));
        apply(paymentRejectedTransaction, Transaction.Outcome.INVENTORY_RESERVED, "reservation-rejected");
        var transactionRef = new AtomicReference<>(paymentRejectedTransaction);
        var views = transactionViews();
        views.upsert(secondStarted);
        var reserved = new InventoryReservedEvent(
            "transaction-payment-rejected", "transaction-payment-rejected", "order-payment-rejected",
            List.of(new dev.desafio.transaction.inventory.domain.StockItem("sku-available", 1)),
            "transaction-payment-rejected", "operation-payment-rejected:payment", "CARD",
            "provider-token-rejected", "master", new BigDecimal("10.00"), "BRL",
            "buyer@example.test", 1,
            "operation-payment-rejected", secondStarted.eventId().toString(), CLOCK.instant()
        );
        var reservation = new InventoryReservation(reserved);
        new PaymentIntegrationEventHandler(paymentPublisher()).on(new PaymentRejected(
            "transaction-payment-rejected", "transaction-payment-rejected", "provider-rejected",
            "PROVIDER_REJECTED", "operation-payment-rejected", "provider-effect", CLOCK.instant()
        ));
        relay("payment");

        var inventoryGateway = mock(org.axonframework.messaging.commandhandling.gateway.CommandGateway.class);
        when(inventoryGateway.send(any(), eq(Object.class))).thenAnswer(invocation -> {
            var release = (ReleaseInventoryCommand) invocation.getArgument(0);
            assertEquals(
                "inventory:transaction-payment-rejected", release.inventoryReservationId()
            );
            reservation.release(
                release.correlationId(), release.causationId(), CLOCK.instant(),
                event -> dispatchInventory(inventoryEvents, InventoryAxonEvents.wrap(event))
            );
            return CompletableFuture.completedFuture(reservation.status());
        });
        var inventoryListener = new AxonInventoryRabbitListener(
            reliable("inventory"), inventoryGateway, legacyInventory(), rabbit, json
        );
        consume(MarketplaceAmqp.eventQueue("inventory"), inventoryListener::receive);
        consume(MarketplaceAmqp.eventQueue("transaction"),
            transactionListener(transactionRef, views)::receive);

        assertEquals(InventoryReservation.Status.RELEASED, reservation.status());
        assertEquals(Transaction.Status.REJECTED, transactionRef.get().status());
    }

    @Test
    @DisplayName("Out-of-order outcomes retry and converge without projection regression @spec:AC-284 @spec:AC-286 @spec:AC-287 @spec:AC-293")
    void outOfOrderOutcomesRetryAndConvergeWithoutProjectionRegression() throws Exception {
        var started = StartTransaction.started(new StartTransaction(
            "transaction-out-of-order", "operation-out-of-order", "buyer@example.test",
            "order-out-of-order", List.of(new Transaction.Item("sku-order", 1)),
            new BigDecimal("12.00"), "BRL", "PIX", null, null
        ), CLOCK.instant());
        var transaction = new AtomicReference<>(Transaction.replay(List.of(started.toDomainEvent())));
        var views = transactionViews();
        views.upsert(started);
        var listener = transactionListener(transaction, views);

        new PaymentIntegrationEventHandler(paymentPublisher()).on(new PaymentApproved(
            "transaction-out-of-order", "transaction-out-of-order", "provider-order",
            "operation-out-of-order", "payment-effect", CLOCK.instant()
        ));
        relay("payment");
        consume(MarketplaceAmqp.eventQueue("transaction"), listener::receive);
        assertEquals(Transaction.Status.ACCEPTED, transaction.get().status());

        var reserved = new InventoryReservedEvent(
            "transaction-out-of-order", "transaction-out-of-order", "order-out-of-order",
            List.of(new dev.desafio.transaction.inventory.domain.StockItem("sku-order", 1)),
            "transaction-out-of-order", "operation-out-of-order:payment", "PIX", null, null,
            new BigDecimal("12.00"), "BRL", "buyer@example.test", 1,
            "operation-out-of-order", started.eventId().toString(), CLOCK.instant()
        );
        new InventoryIntegrationEventHandler(inventoryOutbox()).on(
            new InventoryReservedAxonEvent("transaction-out-of-order", reserved)
        );
        relay("inventory");
        consume(MarketplaceAmqp.eventQueue("transaction"), listener::receive);
        consume(MarketplaceAmqp.eventQueue("transaction"), listener::receive);

        assertEquals(Transaction.Status.PAYMENT_APPROVED, transaction.get().status());
        assertEquals(3, views.find("transaction-out-of-order").orElseThrow().version());
    }

    @Test
    @DisplayName("The lifecycle quality proof uses real PostgreSQL and RabbitMQ without skips @spec:AC-292")
    void lifecycleQualityProofUsesRealInfrastructure() {
        assertTrue(POSTGRES.isRunning());
        assertTrue(RABBIT.isRunning());
        assertTrue(POSTGRES.getJdbcUrl().startsWith("jdbc:postgresql:"));
    }

    private static void relay(String context) {
        var codec = new IntegrationEventJson(json);
        var relay = new OutboxRelay(
            outbox(context),
            new ConfirmedAmqpPublisher(rabbit, codec), codec, CLOCK, context + "-relay"
        );
        assertEquals(1, relay.publishAvailable(10));
    }

    private static void consume(String queue, Delivery delivery) throws Exception {
        try (var channel = connectionFactory.createConnection().createChannel(false)) {
            var response = new AtomicReference<com.rabbitmq.client.GetResponse>();
            await().atMost(Duration.ofSeconds(8)).until(() -> {
                var message = channel.basicGet(queue, false);
                if (message == null) return false;
                response.set(message);
                return true;
            });
            var received = response.get();
            assertNotNull(received, "expected an AMQP message in " + queue);
            var properties = new MessageProperties();
            properties.setDeliveryTag(received.getEnvelope().getDeliveryTag());
            properties.setReceivedRoutingKey(received.getEnvelope().getRoutingKey());
            properties.setHeaders(received.getProps().getHeaders());
            properties.setContentType(received.getProps().getContentType());
            properties.setMessageId(received.getProps().getMessageId());
            properties.setCorrelationId(received.getProps().getCorrelationId());
            delivery.accept(new Message(received.getBody(), properties), channel);
        }
    }

    private static TransactionRabbitListener transactionListener(
        AtomicReference<Transaction> transaction,
        JpaTransactionViewStore views
    ) {
        var commands = mock(org.axonframework.messaging.commandhandling.gateway.CommandGateway.class);
        when(commands.sendAndWait(any())).thenAnswer(invocation -> {
            var command = (RecordTransactionOutcome) invocation.getArgument(0);
            var event = transaction.get().record(command.outcome(), command.reference(), CLOCK.instant());
            if (event.isEmpty() && transaction.get().awaits(command.outcome())) {
                throw new Transaction.OutcomeNotReadyException(transaction.get().status(), command.outcome());
            }
            event.ifPresent(value -> {
                transaction.get().apply(value);
                views.upsert(TransactionEvent.from(value));
            });
            return null;
        });
        return new TransactionRabbitListener(reliable("transaction"), commands);
    }

    private static ReliableAmqpConsumer reliable(String context) {
        return new ReliableAmqpConsumer(
            inbox(context), new IntegrationEventJson(json),
            new AmqpRetryRouter(rabbit, CLOCK)
        );
    }

    private static JpaTransactionOutbox transactionOutbox() {
        return new JpaTransactionOutbox(
            json,
            persistence.getBean(TransactionOutboxJpaRepository.class),
            persistence.getBean(EntityManager.class),
            persistence.getBean(PlatformTransactionManager.class)
        );
    }

    private static JpaTransactionViewStore transactionViews() {
        return new JpaTransactionViewStore(
            persistence.getBean(TransactionViewJpaRepository.class),
            persistence.getBean(PlatformTransactionManager.class)
        );
    }

    private static InventoryOutbox inventoryOutbox() {
        var store = outbox("inventory");
        return (sourceEventId, event) -> store.enqueue(sourceEventId,
            new dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope<>(
                java.util.UUID.nameUUIDFromBytes(sourceEventId.getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                event.eventType(), 1, event.aggregateId(), event.transactionId(), event.correlationId(),
                event.causationId(), event.occurredAt(), json.valueToTree(event.payload())
            ));
    }

    private static PaymentProjection paymentProjection() {
        return persistence.getBean(PaymentProjection.class);
    }

    private static JpaPaymentEffectLedger paymentEffects() {
        return new JpaPaymentEffectLedger(
            persistence.getBean(SpringDataPaymentEffectRepository.class),
            persistence.getBean(PlatformTransactionManager.class)
        );
    }

    private static OutboxPaymentIntegrationEventPublisher paymentPublisher() {
        return new OutboxPaymentIntegrationEventPublisher(outbox("payment"), json);
    }

    private static OutboxStore outbox(String context) {
        var entityManager = persistence.getBean(EntityManager.class);
        var transactions = persistence.getBean(PlatformTransactionManager.class);
        return switch (context) {
            case "transaction" -> JpaOutboxStore.transaction(
                persistence.getBean(
                    dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpOutboxJpaRepository.class
                ), entityManager, json, transactions
            );
            case "inventory" -> JpaOutboxStore.inventory(
                persistence.getBean(
                    dev.desafio.transaction.shared.infrastructure.persistence.InventoryAmqpOutboxJpaRepository.class
                ), entityManager, json, transactions
            );
            case "payment" -> JpaOutboxStore.payment(
                persistence.getBean(
                    dev.desafio.transaction.shared.infrastructure.persistence.PaymentAmqpOutboxJpaRepository.class
                ), entityManager, json, transactions
            );
            default -> throw new IllegalArgumentException("unknown context " + context);
        };
    }

    private static InboxStore inbox(String context) {
        var entityManager = persistence.getBean(EntityManager.class);
        var transactions = persistence.getBean(PlatformTransactionManager.class);
        return switch (context) {
            case "transaction" -> JpaInboxStore.transaction(
                persistence.getBean(
                    dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpInboxJpaRepository.class
                ), entityManager, json, CLOCK, transactions
            );
            case "inventory" -> JpaInboxStore.inventory(
                persistence.getBean(
                    dev.desafio.transaction.shared.infrastructure.persistence.InventoryAmqpInboxJpaRepository.class
                ), entityManager, json, CLOCK, transactions
            );
            case "payment" -> JpaInboxStore.payment(
                persistence.getBean(
                    dev.desafio.transaction.shared.infrastructure.persistence.PaymentAmqpInboxJpaRepository.class
                ), entityManager, json, CLOCK, transactions
            );
            default -> throw new IllegalArgumentException("unknown context " + context);
        };
    }

    private static ConfigurableApplicationContext persistenceContext() {
        return new SpringApplicationBuilder(ChoreographyPersistenceTestApplication.class)
            .web(WebApplicationType.NONE)
            .properties(
                "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "spring.datasource.username=" + POSTGRES.getUsername(),
                "spring.datasource.password=" + POSTGRES.getPassword(),
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.jpa.open-in-view=false",
                "spring.flyway.enabled=false"
            )
            .run();
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({
        DataSourceAutoConfiguration.class,
        HibernateJpaAutoConfiguration.class,
        TransactionAutoConfiguration.class,
        JacksonAutoConfiguration.class
    })
    @EntityScan(basePackageClasses = {
        TransactionOutboxJpaRepository.class,
        SpringDataPaymentRecordRepository.class,
        dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpOutboxJpaRepository.class
    })
    @EnableJpaRepositories(basePackageClasses = {
        TransactionOutboxJpaRepository.class,
        SpringDataPaymentRecordRepository.class,
        dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpOutboxJpaRepository.class
    })
    static class ChoreographyPersistenceTestApplication {
        @Bean
        PaymentProjection paymentProjection(SpringDataPaymentRecordRepository payments) {
            return new JpaPaymentProjection(payments);
        }
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<InventoryService> legacyInventory() {
        return (ObjectProvider<InventoryService>) mock(ObjectProvider.class);
    }

    private static void apply(Transaction transaction, Transaction.Outcome outcome, String reference) {
        transaction.apply(transaction.record(outcome, reference, CLOCK.instant()).orElseThrow());
    }

    private static void duplicatePublished(String schema, String routingKey) throws Exception {
        var envelope = new JdbcTemplate(dataSource).queryForObject(
            "select envelope::text from " + schema + ".amqp_outbox where routing_key = ?",
            String.class, routingKey
        );
        new ConfirmedAmqpPublisher(rabbit, new IntegrationEventJson(json)).publish(
            new IntegrationEventJson(json).read(envelope.getBytes(java.nio.charset.StandardCharsets.UTF_8))
        );
    }

    private static void assertQueueEmpty(String queue) throws Exception {
        try (var channel = connectionFactory.createConnection().createChannel(false)) {
            assertNull(channel.basicGet(queue, true));
        }
    }

    private static void dispatchInventory(
        InventoryIntegrationEventHandler handler,
        Object event
    ) {
        if (event instanceof dev.desafio.transaction.inventory.domain.event.InventoryCommittedAxonEvent committed) {
            handler.on(committed);
        } else if (event instanceof InventoryCommitRejectedAxonEvent rejected) {
            handler.on(rejected);
        } else if (event instanceof InventoryReleasedAxonEvent released) {
            handler.on(released);
        } else if (event instanceof InventoryReservationRejectedAxonEvent rejected) {
            handler.on(rejected);
        } else {
            throw new IllegalArgumentException("unexpected Inventory event " + event);
        }
    }

    @FunctionalInterface
    private interface Delivery {
        void accept(Message message, Channel channel) throws Exception;
    }
}
