package dev.desafio.transaction.transaction.infrastructure.persistence;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "spring.datasource.url")
public final class JdbcTransactionReadRepository implements TransactionReadRepository {
    private static final String TRANSACTION_COLUMNS = """
        transaction_id, operation_key, owner_subject, woo_order_id, amount,
        currency, payment_method, status, outcome_reference, version
        """;

    private final JdbcTemplate jdbc;

    public JdbcTransactionReadRepository(DataSource dataSource) {
        jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public Optional<CheckoutOperationView> findCheckout(String id, String owner) {
        return jdbc.query("""
            select transaction_id, operation_key, status
              from transaction.checkout_operation
             where transaction_id = ? and subject = ?
            """, (row, ignored) -> new CheckoutOperationView(
                row.getString("transaction_id"),
                row.getString("operation_key"),
                "COMPLETED".equals(row.getString("status")) ? "COMPLETED" : "PENDING"
            ), id, owner).stream().findFirst();
    }

    @Override
    public Optional<TransactionView> findTransaction(String transactionId, String owner) {
        return find("transaction_id", transactionId, owner);
    }

    @Override
    public Optional<TransactionView> findTransactionByWooOrder(String wooOrderId, String owner) {
        return find("woo_order_id", wooOrderId, owner);
    }

    private Optional<TransactionView> find(String identityColumn, String identity, String owner) {
        return jdbc.query(
            "select " + TRANSACTION_COLUMNS + " from transaction.transaction_view where "
                + identityColumn + " = ? and owner_subject = ?",
            (row, ignored) -> transaction(row), identity, owner
        ).stream().findFirst();
    }

    private static TransactionView transaction(ResultSet row) throws SQLException {
        return new TransactionView(
            row.getString("transaction_id"), row.getString("operation_key"),
            row.getString("owner_subject"), row.getString("woo_order_id"),
            row.getBigDecimal("amount"), row.getString("currency"),
            row.getString("payment_method"), Transaction.Status.valueOf(row.getString("status")),
            row.getString("outcome_reference"), row.getInt("version")
        );
    }
}
