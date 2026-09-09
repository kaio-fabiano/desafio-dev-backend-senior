package dev.desafio.transaction.payment.application;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PaymentEffectLedger {
    boolean claim(Effect effect);

    Optional<PaymentProvider.Result> completed(UUID effectId);

    void complete(UUID effectId, PaymentProvider.Result result, Instant completedAt);

    record Effect(
        UUID effectId,
        String paymentId,
        String operationKey,
        Type type,
        Instant occurredAt
    ) {}

    enum Type { PROVIDER_PAYMENT, PROVIDER_REFUND }
}
