package dev.desafio.payment.inventory;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository {
    Optional<InventoryService.OutgoingEvent> find(UUID eventId, String operationKey);

    StoredResult save(UUID eventId, InventoryService.OutgoingEvent event);

    record StoredResult(InventoryService.OutgoingEvent event, boolean inserted) {}

    final class Jdbc implements InventoryRepository {
        private final DataSource dataSource;

        public Jdbc(DataSource dataSource) {
            this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
        }

        @Override
        public Optional<InventoryService.OutgoingEvent> find(UUID eventId, String operationKey) {
            try (var connection = dataSource.getConnection()) {
                return find(connection, eventId, operationKey);
            } catch (SQLException error) {
                throw new IllegalStateException("inventory database is unavailable", error);
            }
        }

        @Override
        public StoredResult save(UUID eventId, InventoryService.OutgoingEvent event) {
            try (var connection = dataSource.getConnection()) {
                connection.setAutoCommit(false);
                try {
                    var inserted = insertOutbox(connection, event);
                    var stored = find(connection, eventId, event.operationKey())
                        .orElseThrow(() -> new IllegalStateException("inventory result was not persisted"));
                    try (var statement = connection.prepareStatement("""
                        insert into inventory_inbox (event_id, result_event_id)
                        values (?, ?)
                        on conflict (event_id) do nothing
                        """)) {
                        statement.setObject(1, eventId);
                        statement.setObject(2, stored.eventId());
                        statement.executeUpdate();
                    }
                    connection.commit();
                    return new StoredResult(stored, inserted);
                } catch (RuntimeException | SQLException error) {
                    rollback(connection, error);
                    if (error instanceof RuntimeException runtime) throw runtime;
                    throw new IllegalStateException("inventory transaction failed", error);
                }
            } catch (SQLException error) {
                throw new IllegalStateException("inventory database is unavailable", error);
            }
        }

        private boolean insertOutbox(Connection connection, InventoryService.OutgoingEvent event) throws SQLException {
            try (var statement = connection.prepareStatement("""
                insert into inventory_outbox
                    (event_id, operation_key, event_type, event_version, order_id, reservation_id, reason, occurred_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (operation_key) do nothing
                """)) {
                var payload = event.payload();
                statement.setObject(1, event.eventId());
                statement.setString(2, event.operationKey());
                statement.setString(3, event.eventType());
                statement.setString(4, event.eventVersion());
                statement.setString(5, payload.get("orderId"));
                statement.setString(6, payload.get("reservationId"));
                statement.setString(7, payload.get("reason"));
                statement.setTimestamp(8, Timestamp.from(event.occurredAt()));
                return statement.executeUpdate() == 1;
            }
        }

        private Optional<InventoryService.OutgoingEvent> find(
            Connection connection,
            UUID eventId,
            String operationKey
        ) throws SQLException {
            try (var statement = connection.prepareStatement("""
                select o.event_id, o.operation_key, o.event_type, o.event_version,
                       o.order_id, o.reservation_id, o.reason, o.occurred_at
                  from inventory_outbox o
                  left join inventory_inbox i on i.result_event_id = o.event_id
                 where o.operation_key = ? or i.event_id = ?
                 limit 1
                """)) {
                statement.setString(1, operationKey);
                statement.setObject(2, eventId);
                try (var rows = statement.executeQuery()) {
                    return rows.next() ? Optional.of(readEvent(rows)) : Optional.empty();
                }
            }
        }

        private InventoryService.OutgoingEvent readEvent(ResultSet row) throws SQLException {
            var orderId = row.getString("order_id");
            var reason = row.getString("reason");
            var payload = reason == null
                ? Map.of("orderId", orderId, "reservationId", row.getString("reservation_id"))
                : Map.of("orderId", orderId, "reason", reason);
            return new InventoryService.OutgoingEvent(
                row.getObject("event_id", UUID.class),
                row.getString("event_type"),
                row.getString("event_version"),
                row.getString("operation_key"),
                row.getTimestamp("occurred_at").toInstant(),
                payload
            );
        }

        private static void rollback(Connection connection, Exception original) {
            try {
                connection.rollback();
            } catch (SQLException rollbackError) {
                original.addSuppressed(rollbackError);
            }
        }
    }
}
