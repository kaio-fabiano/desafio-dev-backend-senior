package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public final class JpaPaymentEffectLedger implements PaymentEffectLedger {
    private final SpringDataPaymentEffectRepository effects;
    private final TransactionTemplate transactions;

    public JpaPaymentEffectLedger(
        SpringDataPaymentEffectRepository effects,
        PlatformTransactionManager transactionManager
    ) {
        this.effects = java.util.Objects.requireNonNull(effects, "effects");
        transactions = new TransactionTemplate(
            java.util.Objects.requireNonNull(transactionManager, "transactionManager")
        );
    }

    @Override
    public boolean claim(Effect effect) {
        java.util.Objects.requireNonNull(effect, "effect");
        try {
            return Boolean.TRUE.equals(transactions.execute(status -> {
                if (effects.existsById(effect.effectId())) return false;
                effects.saveAndFlush(PaymentEffectEntity.claimed(effect));
                return true;
            }));
        } catch (DataIntegrityViolationException collision) {
            var stored = transactions.execute(status -> effects.findById(effect.effectId()).orElse(null));
            if (stored == null || !stored.hasIntent(effect)) {
                throw new IllegalArgumentException(
                    "effectId identifies a conflicting payment intent", collision
                );
            }
            return false;
        }
    }

    @Override
    public Optional<PaymentProvider.Result> completed(UUID effectId) {
        return Optional.ofNullable(transactions.execute(status -> effects.findById(effectId)
            .map(PaymentEffectEntity::result)
            .orElse(null)));
    }

    @Override
    public void complete(UUID effectId, PaymentProvider.Result result, Instant completedAt) {
        java.util.Objects.requireNonNull(result, "result");
        java.util.Objects.requireNonNull(completedAt, "completedAt");
        transactions.executeWithoutResult(status -> effects.findLockedByEffectId(effectId)
            .orElseThrow(() -> new IllegalStateException("payment effect claim is missing"))
            .complete(result, completedAt));
    }
}
