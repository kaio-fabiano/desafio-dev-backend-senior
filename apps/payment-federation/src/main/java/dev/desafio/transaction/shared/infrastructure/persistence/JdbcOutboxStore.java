package dev.desafio.transaction.shared.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class JdbcOutboxStore {
    private static final Set<String> OWNED_SCHEMAS = Set.of("transaction", "inventory", "payment");

    private final String table;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final ObjectMapper json;

    public JdbcOutboxStore(DataSource dataSource, ObjectMapper json, String schema) {
        if (!OWNED_SCHEMAS.contains(schema)) {
            throw new IllegalArgumentException(PersistenceErrorMessages.UNKNOWN_CONTEXT_SCHEMA);
        }
        this.table = schema + ".amqp_outbox";
        this.jdbc = new JdbcTemplate(dataSource);
        this.transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        this.json = json;
    }

    public void enqueue(String sourceEventId, IntegrationEventEnvelope<JsonNode> event) {
        var envelope = serialize(event);
        var inserted = jdbc.update("""
            insert into %s (event_id, source_event_id, routing_key, envelope, occurred_at)
            values (?, ?, ?, cast(? as jsonb), ?)
            on conflict (source_event_id) do nothing
            """.formatted(table), event.eventId(), sourceEventId, event.eventType(),
            envelope, Timestamp.from(event.occurredAt()));
        if (inserted == 0) {
            var sameEnvelope = jdbc.queryForObject(
                "select envelope = cast(? as jsonb) from " + table + " where source_event_id = ?",
                Boolean.class,
                envelope,
                sourceEventId
            );
            if (!Boolean.TRUE.equals(sameEnvelope)) {
                throw new IllegalArgumentException(PersistenceErrorMessages.OUTBOX_EVENT_CONFLICT);
            }
        }
    }

    public List<PendingMessage> claim(int limit, String relayId, Instant now, Duration lease) {
        return transaction.execute(ignored -> jdbc.query("""
            with pending as (
                select event_id
                  from %s
                 where published_at is null
                   and (claim_until is null or claim_until < ?)
                 order by occurred_at
                 for update skip locked
                 limit ?
            )
            update %s outbox
               set claimed_by = ?, claim_until = ?,
                   publication_attempts = publication_attempts + 1
              from pending
             where outbox.event_id = pending.event_id
            returning outbox.event_id, outbox.routing_key, outbox.envelope::text
            """.formatted(table, table), (rows, rowNumber) -> new PendingMessage(
                rows.getObject("event_id", UUID.class),
                rows.getString("routing_key"),
                rows.getString("envelope")
            ), Timestamp.from(now), limit, relayId, Timestamp.from(now.plus(lease))));
    }

    public void markPublished(UUID eventId, String relayId, Instant publishedAt) {
        var updated = jdbc.update(
            "update " + table
                + " set published_at = ?, claimed_by = null, claim_until = null, last_error = null"
                + " where event_id = ? and claimed_by = ? and published_at is null",
            Timestamp.from(publishedAt), eventId, relayId
        );
        if (updated != 1) {
            throw new IllegalStateException(PersistenceErrorMessages.OUTBOX_CLAIM_LOST);
        }
    }

    public void release(UUID eventId, String relayId, Exception error) {
        jdbc.update(
            "update " + table
                + " set claimed_by = null, claim_until = null, last_error = ?"
                + " where event_id = ? and claimed_by = ? and published_at is null",
            error.getClass().getName(), eventId, relayId
        );
    }

    public int pendingCount() {
        return jdbc.queryForObject(
            "select count(*) from " + table + " where published_at is null",
            Integer.class
        );
    }

    private String serialize(IntegrationEventEnvelope<JsonNode> event) {
        try {
            return json.writeValueAsString(event);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException(PersistenceErrorMessages.SERIALIZATION_FAILED, error);
        }
    }

    public record PendingMessage(UUID eventId, String routingKey, String envelope) {}
}
