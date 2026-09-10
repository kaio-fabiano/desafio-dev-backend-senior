package dev.desafio.transaction.inventory.infrastructure.persistence;

import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.Optional;

public final class JdbcInventoryViewRepository implements InventoryViewRepository {
    private final JdbcTemplate jdbc;

    public JdbcInventoryViewRepository(DataSource dataSource) {
        jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public Optional<InventoryReservationView> findByTransactionId(String transactionId) {
        return jdbc.query("""
            select inventory_reservation_id, transaction_id, order_id, status,
                   version, reason, updated_at
              from inventory.inventory_reservation_projection
             where transaction_id = ?
            """, (row, ignored) -> new InventoryReservationView(
                row.getString("inventory_reservation_id"), row.getString("transaction_id"),
                row.getString("order_id"), InventoryReservation.Status.valueOf(row.getString("status")),
                row.getLong("version"), row.getString("reason"),
                row.getTimestamp("updated_at").toInstant()
            ), transactionId).stream().findFirst();
    }
}
