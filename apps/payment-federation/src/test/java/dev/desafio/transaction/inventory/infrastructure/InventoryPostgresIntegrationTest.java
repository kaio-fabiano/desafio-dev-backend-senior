package dev.desafio.transaction.inventory.infrastructure;

import dev.desafio.transaction.configuration.ApplicationClockConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.inventory.application.InventoryRepository;
import dev.desafio.transaction.inventory.application.event.InventoryOutbox;
import dev.desafio.transaction.inventory.application.query.InventoryProjectionRepository;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;
import dev.desafio.transaction.inventory.configuration.InventoryConfiguration;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import dev.desafio.transaction.inventory.domain.StockItem;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.testcontainers.containers.PostgreSQLContainer;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

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
    @DisplayName("Inventory PostgreSQL migration passes the repository quality gate @spec:AC-292")
    void migrationCreatesOwnedTablesWithoutCrossSchemaReferences() {
        var jdbc = new JdbcTemplate(dataSource);
        assertEquals(0, jdbc.queryForObject("""
            select count(*) from information_schema.columns
             where table_schema = 'inventory' and table_name = 'inventory_operation'
               and column_name = 'projection_version'
            """, Integer.class));
        assertEquals(1, jdbc.queryForObject("""
            select count(*) from information_schema.columns
             where table_schema = 'inventory'
               and table_name = 'inventory_reservation_projection'
               and column_name = 'version'
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

    @Test
    @DisplayName("Inventory JPA ports round-trip claims and dedicated reservation projections @spec:AC-299")
    void jpaPortsRoundTripAfterClearingThePersistenceContext() {
        try (var context = persistenceContext()) {
            var claims = context.getBean(InventoryRepository.class);
            var projections = context.getBean(InventoryProjectionRepository.class);
            var views = context.getBean(InventoryViewRepository.class);
            var outbox = context.getBean(InventoryOutbox.class);

            assertEquals("JpaInventoryRepository", claims.getClass().getSimpleName());
            assertEquals("JpaInventoryProjectionRepository", projections.getClass().getSimpleName());
            assertEquals("JpaInventoryViewRepository", views.getClass().getSimpleName());
            assertEquals("JpaInventoryOutbox", outbox.getClass().getSimpleName());

            var concurrentRequest = request("jpa-concurrent");
            var firstClaim = CompletableFuture.supplyAsync(() ->
                claims.claim(concurrentRequest, "fingerprint-jpa-concurrent")
            );
            var secondClaim = CompletableFuture.supplyAsync(() ->
                claims.claim(concurrentRequest, "fingerprint-jpa-concurrent")
            );
            var statuses = List.of(firstClaim.join().status(), secondClaim.join().status());
            assertEquals(1, statuses.stream()
                .filter(InventoryRepository.ClaimStatus.ACQUIRED::equals).count());
            assertEquals(1, statuses.stream()
                .filter(InventoryRepository.ClaimStatus.BUSY::equals).count());

            var request = request("jpa-round-trip");
            var acquired = claims.claim(request, "fingerprint-jpa-round-trip");
            var event = new Inventory.OutgoingEvent(
                UUID.randomUUID(), "stock.reserved", "v1", request.operationKey(), NOW,
                Map.of("orderId", request.orderId(), "reservationId", request.operationKey())
            );
            assertEquals(event, claims.complete(acquired, event));

            context.getBean(jakarta.persistence.EntityManager.class).clear();
            var duplicate = claims.claim(
                new Inventory.ReservationRequested(
                    UUID.randomUUID(), request.operationKey(), request.orderId(), request.items()
                ),
                "fingerprint-jpa-round-trip"
            );
            assertEquals(InventoryRepository.ClaimStatus.COMPLETED, duplicate.status());
            assertEquals(event, duplicate.completedEvent());

            for (var status : InventoryReservation.Status.values()) {
                var reason = status == InventoryReservation.Status.REJECTED
                    || status == InventoryReservation.Status.COMMIT_REJECTED
                    ? "STOCK_CHANGED"
                    : null;
                projections.save(new InventoryReservationView(
                    "reservation-jpa-" + status, "transaction-jpa-" + status, "order-jpa",
                    status, 2, reason, NOW
                ));
            }
            context.getBean(jakarta.persistence.EntityManager.class).clear();

            for (var status : InventoryReservation.Status.values()) {
                assertEquals(status, projections.find("reservation-jpa-" + status)
                    .orElseThrow().status());
            }
            assertEquals(
                InventoryReservation.Status.COMMIT_REJECTED,
                views.findByTransactionId("transaction-jpa-COMMIT_REJECTED").orElseThrow().status()
            );
        }
    }

    @Test
    @DisplayName("Flyway schema validates all Inventory JPA mappings across restart @spec:AC-304")
    void flywaySchemaValidatesJpaMappingsAcrossRestart() {
        try (var first = persistenceContext()) {
            assertNotNull(first.getBean(jakarta.persistence.EntityManagerFactory.class));
        }
        try (var restarted = persistenceContext()) {
            assertNotNull(restarted.getBean(jakarta.persistence.EntityManagerFactory.class));
            var jdbc = new JdbcTemplate(restarted.getBean(javax.sql.DataSource.class));
            assertEquals(1, jdbc.queryForObject("""
                select count(*) from information_schema.tables
                 where table_schema = 'inventory'
                   and table_name = 'inventory_reservation_projection'
                """, Integer.class));
        }
    }

    private static org.springframework.context.ConfigurableApplicationContext persistenceContext() {
        return new SpringApplicationBuilder(InventoryJpaTestApplication.class)
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

    @SpringBootConfiguration
    @ImportAutoConfiguration({
        DataSourceAutoConfiguration.class,
        DataSourceTransactionManagerAutoConfiguration.class,
        FlywayAutoConfiguration.class,
        HibernateJpaAutoConfiguration.class,
        JacksonAutoConfiguration.class
    })
    @EntityScan("dev.desafio.transaction.inventory")
    @EnableJpaRepositories("dev.desafio.transaction.inventory")
    @Import({InventoryConfiguration.class, ApplicationClockConfiguration.class})
    static class InventoryJpaTestApplication {}

    private static Inventory.ReservationRequested request(String operationKey) {
        return new Inventory.ReservationRequested(
            UUID.randomUUID(), operationKey, "order-" + operationKey,
            List.of(new Inventory.StockItem("last-unit", 1))
        );
    }

}
