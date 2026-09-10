package dev.desafio.transaction.inventory.infrastructure.persistence;

import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "spring.datasource.url")
public final class JdbcInventoryViewRepository implements InventoryViewRepository {
    private final JdbcTemplate jdbc;

    public JdbcInventoryViewRepository(DataSource dataSource) {
        jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public Optional<InventoryReservationView> findByTransactionId(String transactionId) {
        return jdbc.query("""
            select operation_key, request_fingerprint, order_id, projection_status,
                   projection_version, projection_reason, projection_updated_at
              from inventory.inventory_operation
             where request_fingerprint = ? and state = 'PROJECTION'
            """, (row, ignored) -> new InventoryReservationView(
                row.getString("operation_key").substring("projection:".length()),
                row.getString("request_fingerprint"), row.getString("order_id"),
                InventoryReservation.Status.valueOf(row.getString("projection_status")),
                row.getLong("projection_version"), row.getString("projection_reason"),
                row.getTimestamp("projection_updated_at").toInstant()
            ), transactionId).stream().findFirst();
    }
}
