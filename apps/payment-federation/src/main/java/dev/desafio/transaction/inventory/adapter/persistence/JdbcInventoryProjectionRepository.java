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
            insert into inventory.inventory_reservation_projection
                (inventory_reservation_id, transaction_id, order_id, status, version, reason, updated_at)
            values (?, ?, ?, ?, ?, ?, ?)
            on conflict (inventory_reservation_id) do update
               set transaction_id = excluded.transaction_id,
                   order_id = excluded.order_id,
                   status = excluded.status,
                   version = excluded.version,
                   reason = excluded.reason,
                   updated_at = excluded.updated_at
             where inventory.inventory_reservation_projection.version < excluded.version
            """, view.inventoryReservationId(), view.transactionId(), view.orderId(),
            view.status().name(), view.version(), view.reason(), Timestamp.from(view.updatedAt()));
    }

    @Override
    public Optional<InventoryReservationView> find(String inventoryReservationId) {
        return jdbc.query("""
            select transaction_id, order_id, status, version, reason, updated_at
              from inventory.inventory_reservation_projection
             where inventory_reservation_id = ?
            """, (rows, row) -> new InventoryReservationView(
                inventoryReservationId, rows.getString("transaction_id"),
                rows.getString("order_id"),
                InventoryReservation.Status.valueOf(rows.getString("status")),
                rows.getLong("version"), rows.getString("reason"),
                rows.getTimestamp("updated_at").toInstant()
            ), inventoryReservationId).stream().findFirst();
    }
}
