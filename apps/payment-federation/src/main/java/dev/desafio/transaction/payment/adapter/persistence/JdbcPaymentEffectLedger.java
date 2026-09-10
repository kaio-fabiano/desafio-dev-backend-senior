package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.domain.Payment;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public final class JdbcPaymentEffectLedger implements PaymentEffectLedger {
    private final JdbcTemplate jdbc;

    public JdbcPaymentEffectLedger(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(java.util.Objects.requireNonNull(dataSource, "dataSource"));
    }

    @Override
    public boolean claim(Effect effect) {
        java.util.Objects.requireNonNull(effect, "effect");
        var inserted = jdbc.update("""
            insert into payment.payment_effect (
                effect_id, payment_id, operation_key, effect_type, occurred_at,
                state, idempotency_key
            ) values (?, ?, ?, ?, ?, 'CLAIMED', ?)
            on conflict do nothing
            """,
            effect.effectId(), effect.paymentId(), effect.operationKey(), effect.type().name(),
            Timestamp.from(effect.occurredAt()), effect.operationKey()
        );
        if (inserted == 1) return true;

        var sameIntent = jdbc.queryForObject("""
            select payment_id = ? and operation_key = ? and effect_type = ?
              from payment.payment_effect
             where effect_id = ?
            """, Boolean.class, effect.paymentId(), effect.operationKey(), effect.type().name(), effect.effectId());
        if (!Boolean.TRUE.equals(sameIntent)) {
            throw new IllegalArgumentException(PaymentErrorMessages.EFFECT_ID_IDENTIFIES_CONFLICTING_PAYMENT_INTENT);
        }
        return false;
    }

    @Override
    public Optional<PaymentProvider.Result> completed(UUID effectId) {
        return jdbc.query("""
            select provider_reference, provider_status, pix_code
              from payment.payment_effect
             where effect_id = ? and state = 'COMPLETED'
            """, rows -> rows.next()
                ? Optional.of(new PaymentProvider.Result(
                    rows.getString("provider_reference"),
                    Payment.Status.valueOf(rows.getString("provider_status")),
                    rows.getString("pix_code")
                ))
                : Optional.empty(), effectId);
    }

    @Override
    public void complete(UUID effectId, PaymentProvider.Result result, Instant completedAt) {
        java.util.Objects.requireNonNull(result, "result");
        java.util.Objects.requireNonNull(completedAt, "completedAt");
        var updated = jdbc.update("""
            update payment.payment_effect
               set state = 'COMPLETED', provider_reference = ?, provider_status = ?,
                   pix_code = ?, completed_at = ?
             where effect_id = ? and state = 'CLAIMED'
            """, result.providerReference(), result.status().name(), result.pixCode(),
            Timestamp.from(completedAt), effectId);
        if (updated == 1) return;
        var stored = completed(effectId).orElseThrow(
            () -> new IllegalStateException(PaymentErrorMessages.PAYMENT_EFFECT_CLAIM_IS_MISSING)
        );
        if (!stored.equals(result)) {
            throw new IllegalArgumentException(PaymentErrorMessages.PAYMENT_EFFECT_COMPLETED_WITH_ANOTHER_RESULT);
        }
    }
}
