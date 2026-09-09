package dev.desafio.transaction.migration;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LegacyCleanStartGateIntegrationTest {
    private static final PostgreSQLContainer<?> LEGACY =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final List<String> LEGACY_TABLES = List.of(
        "order_workflow_checkout_operation",
        "order_workflow_order_workflow",
        "order_workflow_inbox_record",
        "order_workflow_outbox_event",
        "commerce_checkout_operation",
        "commerce_order_workflow",
        "commerce_inbox_record",
        "commerce_outbox_event"
    );

    private static JdbcTemplate legacy;

    @BeforeAll
    static void startDatabases() {
        LEGACY.start();
        legacy = jdbc(LEGACY);
        LEGACY_TABLES.forEach(table ->
            legacy.execute("create table " + table + " (id integer primary key)"));
    }

    @BeforeEach
    void resetDatabases() {
        LEGACY_TABLES.forEach(table -> legacy.execute("truncate " + table));
    }

    @AfterAll
    static void stopDatabases() {
        LEGACY.stop();
    }

    @Test
    @DisplayName("Empty legacy state is restartable, side-effect-free, and append-only @spec:AC-290 @spec:AC-292")
    void emptyLegacyStateIsRestartableSideEffectFreeAndAppendOnly() {
        var first = gate().verify();
        var restarted = gate().verify();

        assertEquals(true, first.passed());
        assertEquals(true, restarted.passed());
        assertNotEquals(first.runId(), restarted.runId());
        assertEquals(0, LEGACY_TABLES.stream().mapToInt(table ->
            legacy.queryForObject("select count(*) from " + table, Integer.class)).sum());
    }

    @Test
    @DisplayName("Any current or historical legacy row blocks Java ownership with complete disposition @spec:AC-290 @spec:AC-291")
    void anyCurrentOrHistoricalLegacyRowBlocksJavaOwnership() {
        for (var index = 0; index < LEGACY_TABLES.size(); index++) {
            legacy.update("insert into " + LEGACY_TABLES.get(index) + " (id) values (?)", index);
        }

        var failure = assertThrows(LegacyCleanStartGate.BlockedException.class, gate()::verify);

        assertEquals(2, failure.audit().checkoutRows());
        assertEquals(2, failure.audit().workflowRows());
        assertEquals(2, failure.audit().inboxRows());
        assertEquals(2, failure.audit().outboxRows());
    }

    private LegacyCleanStartGate gate() {
        return new LegacyCleanStartGate(
            LEGACY.getJdbcUrl(), LEGACY.getUsername(), LEGACY.getPassword()
        );
    }

    private static JdbcTemplate jdbc(PostgreSQLContainer<?> postgres) {
        return new JdbcTemplate(new DriverManagerDataSource(
            postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()
        ));
    }

}
