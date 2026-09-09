package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.application.event.PaymentApproved;
import dev.desafio.transaction.payment.application.event.PaymentPending;
import dev.desafio.transaction.payment.application.event.PaymentRefunded;
import dev.desafio.transaction.payment.application.event.PaymentRejected;
import dev.desafio.transaction.payment.application.event.PaymentRequested;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

public final class JdbcPaymentProjection implements PaymentProjection {
    private final JdbcTemplate jdbc;

    public JdbcPaymentProjection(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(java.util.Objects.requireNonNull(dataSource, "dataSource"));
    }

    @Override
    public void project(PaymentRequested event) {
        jdbc.update("""
            insert into payment.payment_record (
                payment_id, operation_key, order_id, method, amount, currency,
                status, provider_reference, pix_code, event_sequence
            ) values (?, ?, ?, ?, ?, ?, 'PENDING', ?, null, 1)
            on conflict (payment_id) do nothing
            """, event.paymentId(), event.operationKey(), event.transactionId(), event.method().name(),
            event.amount(), event.currency(), "pending:" + event.operationKey());
    }

    @Override
    public void project(PaymentPending event) {
        update(
            event.paymentId(),
            event.pixCode() == null ? "PENDING" : "PIX_GENERATED",
            event.providerReference(),
            event.pixCode(),
            2
        );
    }

    @Override
    public void project(PaymentApproved event) {
        update(event.paymentId(), "AUTHORIZED", event.providerReference(), null, 3);
    }

    @Override
    public void project(PaymentRejected event) {
        update(event.paymentId(), "REJECTED", event.providerReference(), null, 3);
    }

    @Override
    public void project(PaymentRefunded event) {
        update(event.paymentId(), "REFUNDED", event.providerReference(), null, 4);
    }

    private void update(
        String paymentId,
        String status,
        String providerReference,
        String pixCode,
        long sequence
    ) {
        var updated = jdbc.update("""
            update payment.payment_record
               set status = ?, provider_reference = ?, pix_code = ?,
                   event_sequence = ?, updated_at = current_timestamp
             where payment_id = ? and event_sequence < ?
            """, status, providerReference, pixCode, sequence, paymentId, sequence);
        if (updated == 0) {
            var exists = jdbc.queryForObject(
                "select count(*) from payment.payment_record where payment_id = ? and event_sequence >= ?",
                Integer.class,
                paymentId,
                sequence
            );
            if (exists == null || exists == 0) {
                throw new IllegalStateException("Payment projection has no requested event");
            }
        }
    }
}
