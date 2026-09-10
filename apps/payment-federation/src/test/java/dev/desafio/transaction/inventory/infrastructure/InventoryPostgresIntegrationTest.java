package dev.desafio.transaction.inventory.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryOutbox;
import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryProjectionRepository;
import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryRepository;
import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.application.StockPort;
import dev.desafio.transaction.inventory.application.axon.InventoryReservedAxonEvent;
import dev.desafio.transaction.inventory.application.event.InventoryIntegrationEventHandler;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InventoryPostgresIntegrationTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static DriverManagerDataSource dataSource;

    @BeforeAll
    static void migrate() {
        POSTGRES.start();
        dataSource = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()
        );
        Flyway.configure().dataSource(dataSource).defaultSchema("axon")
            .schemas("axon", "transaction", "inventory", "payment")
            .locations("classpath:db/migration").load().migrate();
    }

    @AfterAll
    static void stop() {
        POSTGRES.stop();
    }

    @Test
    @DisplayName("Inventory projection remains durable and ignores stale replay updates @spec:AC-282")
    void projectionSurvivesRestartAndReplay() {
        var first = new JdbcInventoryProjectionRepository(dataSource);
        first.save(view(2, InventoryReservation.Status.COMMITTED));

        var restarted = new JdbcInventoryProjectionRepository(dataSource);
        restarted.save(view(1, InventoryReservation.Status.RESERVED));

        assertEquals(InventoryReservation.Status.COMMITTED,
            restarted.find("tx-246").orElseThrow().status());
        assertEquals(2, restarted.find("tx-246").orElseThrow().version());
    }

    @Test
    @DisplayName("Concurrent last-unit reservations have one independently consistent winner @spec:AC-284")
    void concurrentLastUnitHasOneWinner() {
        var remaining = new AtomicInteger(1);
        StockPort stock = request -> {
            if (remaining.getAndDecrement() < 1) throw new Inventory.InsufficientStockException();
        };
        var first = new InventoryService(
            new JdbcInventoryRepository(dataSource), stock, Clock.fixed(NOW, ZoneOffset.UTC)
        );
        var second = new InventoryService(
            new JdbcInventoryRepository(dataSource), stock, Clock.fixed(NOW, ZoneOffset.UTC)
        );

        var a = CompletableFuture.supplyAsync(() -> first.handle(request("reserve-a")));
        var b = CompletableFuture.supplyAsync(() -> second.handle(request("reserve-b")));
        var types = List.of(a.join().event().eventType(), b.join().event().eventType());

        assertEquals(1, types.stream().filter("stock.reserved"::equals).count());
        assertEquals(1, types.stream().filter("stock.reservation-failed"::equals).count());
    }

    @Test
    @DisplayName("Inventory result is durable before RabbitMQ publication @spec:AC-293")
    void resultIsWrittenToTheContextOutbox() {
        var handler = new InventoryIntegrationEventHandler(
            new JdbcInventoryOutbox(dataSource, new ObjectMapper().findAndRegisterModules())
        );
        handler.on(new InventoryReservedAxonEvent("tx-outbox-246", new InventoryReservedEvent(
            "tx-outbox-246", "tx-outbox-246", "order-246", List.of(new StockItem("sku-1", 1)),
            1, "correlation-246", "causation-246", NOW
        )));

        var jdbc = new JdbcTemplate(dataSource);
        assertEquals("inventory.reserved.v1", jdbc.queryForObject(
            "select routing_key from inventory.amqp_outbox where source_event_id = ?",
            String.class, "tx-outbox-246:1:inventory.reserved.v1"
        ));
        assertEquals("causation-246", jdbc.queryForObject(
            "select envelope ->> 'causationId' from inventory.amqp_outbox where source_event_id = ?",
            String.class, "tx-outbox-246:1:inventory.reserved.v1"
        ));
    }

    @Test
    @DisplayName("Inventory PostgreSQL migration passes the repository quality gate @spec:AC-292")
    void migrationCreatesOwnedTablesWithoutCrossSchemaReferences() {
        var jdbc = new JdbcTemplate(dataSource);
        assertEquals(1, jdbc.queryForObject("""
            select count(*) from information_schema.columns
             where table_schema = 'inventory' and table_name = 'inventory_operation'
               and column_name = 'projection_version'
            """, Integer.class));
        assertEquals(0, jdbc.queryForObject("""
            select count(*)
              from pg_constraint constraint_definition
              join pg_class owned_table on owned_table.oid = constraint_definition.conrelid
              join pg_namespace owned_schema on owned_schema.oid = owned_table.relnamespace
              join pg_class referenced_table on referenced_table.oid = constraint_definition.confrelid
              join pg_namespace referenced_schema on referenced_schema.oid = referenced_table.relnamespace
             where constraint_definition.contype = 'f'
               and owned_schema.nspname = 'inventory'
               and referenced_schema.nspname <> 'inventory'
            """, Integer.class));
    }

    private static Inventory.ReservationRequested request(String operationKey) {
        return new Inventory.ReservationRequested(
            UUID.randomUUID(), operationKey, "order-" + operationKey,
            List.of(new Inventory.StockItem("last-unit", 1))
        );
    }

    private static InventoryReservationView view(long version, InventoryReservation.Status status) {
        return new InventoryReservationView(
            "tx-246", "tx-246", "order-246", status, version, null, NOW
        );
    }
}
