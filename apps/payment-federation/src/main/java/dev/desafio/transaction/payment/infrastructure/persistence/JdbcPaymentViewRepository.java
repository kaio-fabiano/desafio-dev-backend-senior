package dev.desafio.transaction.payment.infrastructure.persistence;

import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.payment.application.query.PaymentViewRepository;
import dev.desafio.transaction.payment.domain.Payment;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "spring.datasource.url")
public final class JdbcPaymentViewRepository implements PaymentViewRepository {
    private final JdbcTemplate jdbc;

    public JdbcPaymentViewRepository(DataSource dataSource) {
        jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public Optional<PaymentView> findByTransactionId(String transactionId) {
        return jdbc.query("""
            select payment_id, operation_key, order_id, method, amount, currency,
                   status, provider_reference, pix_code
              from payment.payment_record
             where order_id = ?
            """, (row, ignored) -> new PaymentView(
                row.getString("payment_id"), row.getString("operation_key"),
                row.getString("order_id"), Payment.Method.valueOf(row.getString("method")),
                row.getBigDecimal("amount"), row.getString("currency"),
                Payment.Status.valueOf(row.getString("status")),
                row.getString("provider_reference"), row.getString("pix_code")
            ), transactionId).stream().findFirst();
    }
}
