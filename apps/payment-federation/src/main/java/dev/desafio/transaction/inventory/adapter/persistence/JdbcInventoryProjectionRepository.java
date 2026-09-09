package dev.desafio.transaction.inventory.adapter.persistence;

import dev.desafio.transaction.inventory.application.query.InventoryProjectionRepository;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.util.Optional;

public final class JdbcInventoryProjectionRepository implements InventoryProjectionRepository {
    private final JdbcTemplate jdbc;

    public JdbcInventoryProjectionRepository(DataSource dataSource) {
        jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public void save(InventoryReservationView view) {
        jdbc.update("""
            insert into inventory.inventory_operation
                (operation_key, order_id, request_fingerprint, state,
                 projection_status, projection_version, projection_reason, projection_updated_at)
            values (?, ?, ?, 'PROJECTION', ?, ?, ?, ?)
            on conflict (operation_key) do update
               set projection_status = excluded.projection_status,
                   projection_version = excluded.projection_version,
                   projection_reason = excluded.projection_reason,
                   projection_updated_at = excluded.projection_updated_at,
                   updated_at = current_timestamp
             where inventory.inventory_operation.state = 'PROJECTION'
               and inventory.inventory_operation.projection_version < excluded.projection_version
            """, key(view.inventoryReservationId()), view.orderId(), view.transactionId(),
            view.status().name(), view.version(), view.reason(), Timestamp.from(view.updatedAt()));
    }

    @Override
    public Optional<InventoryReservationView> find(String inventoryReservationId) {
        return jdbc.query("""
            select operation_key, request_fingerprint, order_id, projection_status,
                   projection_version, projection_reason, projection_updated_at
              from inventory.inventory_operation
             where operation_key = ? and state = 'PROJECTION'
            """, (rows, row) -> new InventoryReservationView(
                inventoryReservationId, rows.getString("request_fingerprint"),
                rows.getString("order_id"),
                InventoryReservation.Status.valueOf(rows.getString("projection_status")),
                rows.getLong("projection_version"), rows.getString("projection_reason"),
                rows.getTimestamp("projection_updated_at").toInstant()
            ), key(inventoryReservationId)).stream().findFirst();
    }

    private static String key(String inventoryReservationId) {
        return "projection:" + inventoryReservationId;
    }
}
