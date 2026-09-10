package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.util.Set;

public final class JdbcInboxStore implements InboxStore {
    private static final Set<String> OWNED_SCHEMAS = Set.of("transaction", "inventory", "payment");

    private final String table;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final ObjectMapper json;

    public JdbcInboxStore(DataSource dataSource, ObjectMapper json, String schema) {
        if (!OWNED_SCHEMAS.contains(schema)) throw new IllegalArgumentException("unknown context schema");
        this.table = schema + ".amqp_inbox";
        this.jdbc = new JdbcTemplate(dataSource);
        this.transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        this.json = json;
    }

    public boolean processOnce(
        String consumer,
        IntegrationEventEnvelope<JsonNode> event,
        Handler handler
    ) {
        var envelope = serialize(event);
        var shouldProcess = transaction.execute(ignored -> {
            var inserted = jdbc.update("""
                insert into %s (
                    consumer_name, event_id, event_type, correlation_id, causation_id,
                    envelope, disposition
                ) values (?, ?, ?, ?, ?, cast(? as jsonb), 'PROCESSING')
                on conflict do nothing
                """.formatted(table), consumer, event.eventId(), event.eventType(),
                event.correlationId(), event.causationId(), envelope);
            if (inserted == 0) {
                var sameEnvelope = jdbc.queryForObject(
                    "select envelope = cast(? as jsonb) from " + table
                        + " where consumer_name = ? and event_id = ?",
                    Boolean.class,
                    envelope,
                    consumer,
                    event.eventId()
                );
                if (!Boolean.TRUE.equals(sameEnvelope)) {
                    throw new IllegalArgumentException("eventId identifies a different envelope");
                }
                return "PROCESSING".equals(jdbc.queryForObject(
                    "select disposition from " + table
                        + " where consumer_name = ? and event_id = ?",
                    String.class,
                    consumer,
                    event.eventId()
                ));
            }
            return true;
        });
        if (!Boolean.TRUE.equals(shouldProcess)) return false;

        var disposition = handler.handle(event);
        var updated = transaction.execute(ignored -> jdbc.update(
            "update " + table
                + " set disposition = ?, completed_at = current_timestamp"
                + " where consumer_name = ? and event_id = ? and disposition = 'PROCESSING'",
            disposition.name(),
            consumer,
            event.eventId()
        ));
        if (updated != 1) throw new IllegalStateException("inbox completion was not persisted");
        return true;
    }

    public String disposition(String consumer, java.util.UUID eventId) {
        return jdbc.queryForObject(
            "select disposition from " + table + " where consumer_name = ? and event_id = ?",
            String.class,
            consumer,
            eventId
        );
    }

    private String serialize(IntegrationEventEnvelope<JsonNode> event) {
        try {
            return json.writeValueAsString(event);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("integration event cannot be serialized", error);
        }
    }

}
