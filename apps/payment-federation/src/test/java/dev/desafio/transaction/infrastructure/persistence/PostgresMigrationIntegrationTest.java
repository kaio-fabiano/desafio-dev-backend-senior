package dev.desafio.transaction.infrastructure.persistence;

import dev.desafio.transaction.PaymentFederationApplication;
import org.axonframework.eventsourcing.eventstore.EventStorageEngine;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.Set;

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
    @DisplayName("Fresh PostgreSQL migrations and the application baseline pass real quality gates @spec:AC-292")
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
            assertEquals(5, jdbc.queryForObject(
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
                "axon.aggregate_event_entry",
                "axon.token_entry",
                "axon.persistence_probe_projection",
                "axon.flyway_schema_history"
            ), ownedTables);
            assertInstanceOf(AggregateBasedJpaEventStorageEngine.class,
                context.getBean(EventStorageEngine.class));
            assertInstanceOf(JpaTokenStore.class, context.getBean(TokenStore.class));
            assertEquals(21, Runtime.version().feature());
        }
    }

    private ConfigurableApplicationContext startApplication() {
        return new SpringApplicationBuilder(PaymentFederationApplication.class)
            .web(WebApplicationType.NONE)
            .profiles("test")
            .properties(
                "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "spring.datasource.username=" + POSTGRES.getUsername(),
                "spring.datasource.password=" + POSTGRES.getPassword(),
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.rabbitmq.listener.simple.auto-startup=false",
                "management.health.rabbit.enabled=false",
                "payment.provider.mode=deterministic"
            )
            .run();
    }
}
