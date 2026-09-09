package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.application.TransactionViewStore;
import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.Optional;

public final class JdbcTransactionViewStore implements TransactionViewStore {
    private final JdbcTemplate jdbc;

    public JdbcTransactionViewStore(DataSource dataSource) {
        jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public void upsert(TransactionEvent event) {
        jdbc.update("""
            insert into transaction.transaction_view (
                transaction_id, operation_key, owner_subject, woo_order_id, amount,
                currency, payment_method, status, outcome_reference, version, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (transaction_id) do update
               set status = excluded.status, outcome_reference = excluded.outcome_reference,
                   version = excluded.version, updated_at = excluded.updated_at
             where transaction.transaction_view.version < excluded.version
            """, event.transactionId(), event.operationKey(), event.owner(), event.wooOrderId(),
            event.amount(), event.currency(), event.paymentMethod(), event.status().name(),
            event.reference(), event.version(), java.sql.Timestamp.from(event.occurredAt()));
    }

    @Override
    public Optional<TransactionView> find(String transactionId) {
        return jdbc.query("""
            select transaction_id, operation_key, owner_subject, woo_order_id, amount,
                   currency, payment_method, status, outcome_reference, version
              from transaction.transaction_view where transaction_id = ?
            """, (rows, rowNumber) -> new TransactionView(
                rows.getString("transaction_id"), rows.getString("operation_key"),
                rows.getString("owner_subject"), rows.getString("woo_order_id"),
                rows.getBigDecimal("amount"), rows.getString("currency"),
                rows.getString("payment_method"), Transaction.Status.valueOf(rows.getString("status")),
                rows.getString("outcome_reference"), rows.getInt("version")
            ), transactionId).stream().findFirst();
    }
}
