package dev.desafio.payment.inventory;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public interface InventoryRepository {
    Claim claim(InventoryService.ReservationRequested request, String requestFingerprint);

    InventoryService.OutgoingEvent complete(Claim claim, InventoryService.OutgoingEvent event);

    enum ClaimStatus { ACQUIRED, BUSY, COMPLETED }

    record Claim(ClaimStatus status, UUID incomingEventId, String operationKey, UUID ownerToken,
                 InventoryService.OutgoingEvent completedEvent) {
        public Claim {
            Objects.requireNonNull(status, "status");
            Objects.requireNonNull(incomingEventId, "incomingEventId");
            Objects.requireNonNull(operationKey, "operationKey");
            if (status == ClaimStatus.ACQUIRED && ownerToken == null) {
                throw new IllegalArgumentException("an acquired inventory claim requires an owner token");
            }
            if (status == ClaimStatus.COMPLETED && completedEvent == null) {
                throw new IllegalArgumentException("a completed inventory claim requires its event");
            }
        }
    }

    final class Jdbc implements InventoryRepository {
        private final DataSource dataSource;

        public Jdbc(DataSource dataSource) {
            this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
        }

        @Override
        public Claim claim(InventoryService.ReservationRequested request, String requestFingerprint) {
            Objects.requireNonNull(request, "request");
            Objects.requireNonNull(requestFingerprint, "requestFingerprint");
            var ownerToken = UUID.randomUUID();
            try (var connection = dataSource.getConnection()) {
                connection.setAutoCommit(false);
                try {
                    var acquired = insertClaim(connection, request, requestFingerprint, ownerToken);
                    if (!acquired) acquired = reclaimExpired(connection, request, requestFingerprint, ownerToken);
                    var stored = readClaim(connection, request, requestFingerprint, ownerToken, acquired);
                    if (stored.status() == ClaimStatus.COMPLETED) {
                        recordInbox(connection, request.eventId(), stored.completedEvent().eventId());
                    }
                    connection.commit();
                    return stored;
                } catch (RuntimeException | SQLException error) {
                    rollback(connection, error);
                    if (error instanceof RuntimeException runtime) throw runtime;
                    throw new IllegalStateException("inventory claim transaction failed", error);
                }
            } catch (SQLException error) {
                throw new IllegalStateException("inventory database is unavailable", error);
            }
        }

        @Override
        public InventoryService.OutgoingEvent complete(Claim claim, InventoryService.OutgoingEvent event) {
            Objects.requireNonNull(claim, "claim");
            Objects.requireNonNull(event, "event");
            if (claim.status() != ClaimStatus.ACQUIRED || !claim.operationKey().equals(event.operationKey())) {
                throw new IllegalArgumentException("only the acquired inventory claim can be completed");
            }
            try (var connection = dataSource.getConnection()) {
                connection.setAutoCommit(false);
                try {
                    insertOutbox(connection, event);
                    var stored = findOutbox(connection, event.operationKey());
                    try (var statement = connection.prepareStatement("""
                        update inventory_operation
                           set state = 'COMPLETED', owner_token = null, lease_until = null,
                               result_event_id = ?, updated_at = current_timestamp
                         where operation_key = ? and state = 'CLAIMED' and owner_token = ?
                        """)) {
                        statement.setObject(1, stored.eventId());
                        statement.setString(2, claim.operationKey());
                        statement.setObject(3, claim.ownerToken());
                        if (statement.executeUpdate() != 1) {
                            throw new IllegalStateException("inventory claim ownership was lost before completion");
                        }
                    }
                    recordInbox(connection, claim.incomingEventId(), stored.eventId());
                    connection.commit();
                    return stored;
                } catch (RuntimeException | SQLException error) {
                    rollback(connection, error);
                    if (error instanceof RuntimeException runtime) throw runtime;
                    throw new IllegalStateException("inventory completion transaction failed", error);
                }
            } catch (SQLException error) {
                throw new IllegalStateException("inventory database is unavailable", error);
            }
        }

        private boolean insertClaim(Connection connection, InventoryService.ReservationRequested request,
                                    String fingerprint, UUID ownerToken) throws SQLException {
            try (var statement = connection.prepareStatement("""
                insert into inventory_operation
                    (operation_key, order_id, request_fingerprint, state, owner_token, lease_until)
                values (?, ?, ?, 'CLAIMED', ?, current_timestamp + interval '60 seconds')
                on conflict (operation_key) do nothing
                """)) {
                statement.setString(1, request.operationKey());
                statement.setString(2, request.orderId());
                statement.setString(3, fingerprint);
                statement.setObject(4, ownerToken);
                return statement.executeUpdate() == 1;
            }
        }

        private boolean reclaimExpired(Connection connection, InventoryService.ReservationRequested request,
                                       String fingerprint, UUID ownerToken) throws SQLException {
            try (var statement = connection.prepareStatement("""
                update inventory_operation
                   set owner_token = ?, lease_until = current_timestamp + interval '60 seconds',
                       updated_at = current_timestamp
                 where operation_key = ? and order_id = ? and request_fingerprint = ?
                   and state = 'CLAIMED' and lease_until <= current_timestamp
                """)) {
                statement.setObject(1, ownerToken);
                statement.setString(2, request.operationKey());
                statement.setString(3, request.orderId());
                statement.setString(4, fingerprint);
                return statement.executeUpdate() == 1;
            }
        }

        private Claim readClaim(Connection connection, InventoryService.ReservationRequested request,
                                String fingerprint, UUID ownerToken, boolean acquired) throws SQLException {
            try (var statement = connection.prepareStatement("""
                select i.order_id, i.request_fingerprint, i.state, i.owner_token,
                       o.event_id, o.operation_key, o.event_type, o.event_version,
                       o.order_id as result_order_id, o.reservation_id, o.reason, o.occurred_at
                  from inventory_operation i
                  left join inventory_outbox o on o.event_id = i.result_event_id
                 where i.operation_key = ?
                """)) {
                statement.setString(1, request.operationKey());
                try (var rows = statement.executeQuery()) {
                    if (!rows.next()) throw new IllegalStateException("inventory claim was not persisted");
                    if (!request.orderId().equals(rows.getString("order_id"))
                        || !fingerprint.equals(rows.getString("request_fingerprint"))) {
                        throw new IllegalArgumentException("operationKey identifies a different inventory request");
                    }
                    if ("COMPLETED".equals(rows.getString("state"))) {
                        return new Claim(ClaimStatus.COMPLETED, request.eventId(), request.operationKey(), null,
                            readEvent(rows));
                    }
                    var storedOwner = rows.getObject("owner_token", UUID.class);
                    return new Claim(acquired && ownerToken.equals(storedOwner) ? ClaimStatus.ACQUIRED : ClaimStatus.BUSY,
                        request.eventId(), request.operationKey(), acquired ? ownerToken : null, null);
                }
            }
        }

        private void insertOutbox(Connection connection, InventoryService.OutgoingEvent event) throws SQLException {
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
                statement.executeUpdate();
            }
        }

        private InventoryService.OutgoingEvent findOutbox(Connection connection, String operationKey) throws SQLException {
            try (var statement = connection.prepareStatement("""
                select event_id, operation_key, event_type, event_version,
                       order_id as result_order_id, reservation_id, reason, occurred_at
                  from inventory_outbox where operation_key = ?
                """)) {
                statement.setString(1, operationKey);
                try (var rows = statement.executeQuery()) {
                    if (!rows.next()) throw new IllegalStateException("inventory result was not persisted");
                    return readEvent(rows);
                }
            }
        }

        private void recordInbox(Connection connection, UUID eventId, UUID resultEventId) throws SQLException {
            try (var statement = connection.prepareStatement("""
                insert into inventory_inbox (event_id, result_event_id) values (?, ?)
                on conflict (event_id) do nothing
                """)) {
                statement.setObject(1, eventId);
                statement.setObject(2, resultEventId);
                statement.executeUpdate();
            }
        }

        private InventoryService.OutgoingEvent readEvent(ResultSet row) throws SQLException {
            var orderId = row.getString("result_order_id");
            var reason = row.getString("reason");
            var payload = reason == null
                ? Map.of("orderId", orderId, "reservationId", row.getString("reservation_id"))
                : Map.of("orderId", orderId, "reason", reason);
            return new InventoryService.OutgoingEvent(
                row.getObject("event_id", UUID.class), row.getString("event_type"),
                row.getString("event_version"), row.getString("operation_key"),
                row.getTimestamp("occurred_at").toInstant(), payload
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
