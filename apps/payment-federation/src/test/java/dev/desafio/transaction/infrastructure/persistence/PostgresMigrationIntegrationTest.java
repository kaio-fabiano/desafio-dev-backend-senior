package dev.desafio.transaction.infrastructure.persistence;

import dev.desafio.transaction.PaymentFederationApplication;
import dev.desafio.transaction.inventory.adapter.messaging.InventoryRabbitListener;
import dev.desafio.transaction.inventory.application.StockPort;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommandHandler;
import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.payment.application.PaymentHandler;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelayScheduler;
import dev.desafio.transaction.transaction.application.command.StartTransaction;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.eventsourcing.eventstore.EventStorageEngine;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.axonframework.eventsourcing.eventstore.jpa.AggregateBasedJpaEventStorageEngine;
import org.axonframework.messaging.eventhandling.processing.streaming.token.store.TokenStore;
import org.axonframework.messaging.eventhandling.processing.streaming.token.store.jpa.JpaTokenStore;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class PostgresMigrationIntegrationTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeAll
    static void startPostgres() {
        POSTGRES.start();
    }

    @AfterAll
    static void stopPostgres() {
        POSTGRES.stop();
    }

    @Test
    @DisplayName("Fresh PostgreSQL migrations expose every AMQP consumer at startup @spec:AC-286 @spec:AC-292 @spec:AC-293")
    void freshPostgresMigrationsAndApplicationBaselinePassRealQualityGates() {
        try (var context = startApplication()) {
            var jdbc = context.getBean(JdbcTemplate.class);
            var schemas = Set.copyOf(jdbc.queryForList(
                "select schema_name from information_schema.schemata",
                String.class
            ));

            assertEquals(Set.of("transaction", "inventory", "payment", "axon"),
                schemas.stream().filter(Set.of("transaction", "inventory", "payment", "axon")::contains)
                    .collect(java.util.stream.Collectors.toSet()));
            assertEquals(6, jdbc.queryForObject(
                "select count(*) from axon.flyway_schema_history where version is not null and success",
                Integer.class
            ));
            assertEquals(0, jdbc.queryForObject(
                "select count(*) from information_schema.tables where table_schema = 'public'", Integer.class
            ));
            var ownedTables = Set.copyOf(jdbc.queryForList("""
                select table_schema || '.' || table_name
                  from information_schema.tables
                 where table_schema in ('transaction', 'inventory', 'payment', 'axon')
                """, String.class));
            assertEquals(Set.of(
                "payment.payment_record",
                "payment.payment_effect",
                "payment.payment_outbox",
                "payment.payment_inbox",
                "payment.provider_notification_inbox",
                "inventory.inventory_operation",
                "inventory.inventory_outbox",
                "inventory.inventory_inbox",
                "transaction.checkout_operation",
                "transaction.transaction_view",
                "transaction.amqp_inbox",
                "transaction.amqp_outbox",
                "inventory.amqp_inbox",
                "inventory.amqp_outbox",
                "payment.amqp_inbox",
                "payment.amqp_outbox",
                "axon.aggregate_event_entry",
                "axon.token_entry",
                "axon.persistence_probe_projection",
                "axon.flyway_schema_history"
            ), ownedTables);
            assertInstanceOf(AggregateBasedJpaEventStorageEngine.class,
                context.getBean(EventStorageEngine.class));
            assertInstanceOf(JpaTokenStore.class, context.getBean(TokenStore.class));
            assertInstanceOf(PaymentHandler.class, context.getBean(PaymentHandler.class));
            assertInstanceOf(PaymentRepository.class, context.getBean(PaymentRepository.class));
            assertInstanceOf(InventoryRabbitListener.class,
                context.getBean(InventoryRabbitListener.class));
            assertInstanceOf(ReserveInventoryCommandHandler.class,
                context.getBean(ReserveInventoryCommandHandler.class));
            assertEquals(3, context.getBeansOfType(OutboxRelayScheduler.class).size());
            assertEquals(26, Runtime.version().feature());
        }
    }

    @Test
    @DisplayName("Context-qualified aggregate IDs append independent replayable streams @spec:AC-282 @spec:AC-286 @spec:AC-293")
    void contextQualifiedAggregateIdsAppendIndependentStreams() {
        try (var context = startApplication()) {
            var commands = context.getBean(CommandGateway.class);
            var transactionId = "shared-" + UUID.randomUUID();
            commands.sendAndWait(new StartTransaction(
                transactionId, "operation-shared", "buyer", "1004",
                List.of(new Transaction.Item("1001", 1)), new BigDecimal("19.90"), "BRL", "PIX"
            ), String.class);

            var status = commands.sendAndWait(new ReserveInventoryCommand(
                "inventory:" + transactionId, UUID.randomUUID(), "operation-shared:inventory",
                transactionId, "1004", List.of(new StockItem("1001", 1)),
                "payment:" + transactionId, "operation-shared:payment", "PIX",
                new BigDecimal("19.90"), "BRL", "buyer@example.test",
                "operation-shared", "transaction-started"
            ), Object.class);

            assertEquals(dev.desafio.transaction.inventory.domain.InventoryReservation.Status.RESERVED,
                status);
        }
    }

    private ConfigurableApplicationContext startApplication() {
        return new SpringApplicationBuilder(
            PaymentFederationApplication.class,
            InventoryStockTestConfiguration.class
        )
            .web(WebApplicationType.NONE)
            .profiles("test")
            .properties(
                "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "spring.datasource.username=" + POSTGRES.getUsername(),
                "spring.datasource.password=" + POSTGRES.getPassword(),
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.rabbitmq.listener.simple.auto-startup=false",
                "management.health.rabbit.enabled=false",
                "payment.provider.mode=deterministic",
                "wordpress.graphql-url=http://unused/graphql",
                "spring.main.allow-bean-definition-overriding=true"
            )
            .run();
    }

    @Configuration(proxyBeanMethods = false)
    static class InventoryStockTestConfiguration {
        @Bean("wooInventoryAdapter")
        @Primary
        StockPort wooInventoryAdapter() {
            return new StockPort() {
                @Override
                public void reserve(Inventory.ReservationRequested request) {}

                @Override
                public Inventory.StockState reconcile(Inventory.ReservationRequested request) {
                    return Inventory.StockState.AVAILABLE;
                }
            };
        }
    }
}
