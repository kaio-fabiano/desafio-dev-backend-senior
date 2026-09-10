package dev.desafio.transaction.migration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "migration.legacy-clean-start.enabled", havingValue = "true")
public final class LegacyCleanStartGate implements ApplicationRunner {
    private static final Logger LOG = LoggerFactory.getLogger(LegacyCleanStartGate.class);
    private static final List<String> CHECKOUT_TABLES = List.of(
        "order_workflow_checkout_operation", "commerce_checkout_operation"
    );
    private static final List<String> WORKFLOW_TABLES = List.of(
        "order_workflow_order_workflow", "commerce_order_workflow"
    );
    private static final List<String> INBOX_TABLES = List.of(
        "order_workflow_inbox_record", "commerce_inbox_record"
    );
    private static final List<String> OUTBOX_TABLES = List.of(
        "order_workflow_outbox_event", "commerce_outbox_event"
    );

    private final String url;
    private final String username;
    private final String password;

    public LegacyCleanStartGate(
        @Value("${migration.legacy-clean-start.url}") String url,
        @Value("${migration.legacy-clean-start.username}") String username,
        @Value("${migration.legacy-clean-start.password}") String password
    ) {
        this.url = required(url, "migration.legacy-clean-start.url");
        this.username = required(username, "migration.legacy-clean-start.username");
        this.password = password == null ? "" : password;
    }

    @Override
    public void run(ApplicationArguments ignored) {
        verify();
    }

    public Audit verify() {
        try (var connection = DriverManager.getConnection(url, username, password)) {
            connection.setReadOnly(true);
            connection.setAutoCommit(false);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            var audit = new Audit(
                UUID.randomUUID(),
                Instant.now(),
                count(connection, CHECKOUT_TABLES),
                count(connection, WORKFLOW_TABLES),
                count(connection, INBOX_TABLES),
                count(connection, OUTBOX_TABLES)
            );
            connection.commit();
            LOG.info("Legacy clean-start audit: {}", audit);
            if (!audit.passed()) throw new BlockedException(audit);
            return audit;
        } catch (SQLException error) {
            throw new IllegalStateException(MigrationErrorMessages.INSPECTION_BLOCKED, error);
        }
    }

    private static long count(Connection connection, List<String> tables) throws SQLException {
        long total = 0;
        for (var table : tables) {
            try (var exists = connection.prepareStatement("select to_regclass(?)")) {
                exists.setString(1, "public." + table);
                try (var result = exists.executeQuery()) {
                    result.next();
                    if (result.getString(1) == null) continue;
                }
            }
            try (var statement = connection.createStatement();
                 var result = statement.executeQuery("select count(*) from public.\"" + table + "\"")) {
                result.next();
                total += result.getLong(1);
            }
        }
        return total;
    }

    private static String required(String value, String property) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(MigrationErrorMessages.required(property));
        }
        return value;
    }

    public record Audit(
        UUID runId,
        Instant checkedAt,
        long checkoutRows,
        long workflowRows,
        long inboxRows,
        long outboxRows
    ) {
        public boolean passed() {
            return checkoutRows + workflowRows + inboxRows + outboxRows == 0;
        }
    }

    public static final class BlockedException extends IllegalStateException {
        private final Audit audit;

        BlockedException(Audit audit) {
            super(MigrationErrorMessages.blocked(audit));
            this.audit = audit;
        }

        public Audit audit() {
            return audit;
        }
    }
}
