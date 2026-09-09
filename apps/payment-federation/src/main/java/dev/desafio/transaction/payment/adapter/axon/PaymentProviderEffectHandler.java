package dev.desafio.transaction.payment.adapter.axon;

import dev.desafio.transaction.payment.application.PaymentEffectLedger;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.command.RecordPaymentOutcome;
import dev.desafio.transaction.payment.application.event.PaymentRefundRequested;
import dev.desafio.transaction.payment.application.event.PaymentRequested;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;
import org.axonframework.messaging.core.unitofwork.ProcessingContext;

import java.time.Clock;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

public final class PaymentProviderEffectHandler {
    private final PaymentEffectLedger effects;
    private final PaymentProvider provider;
    private final CommandGateway commands;
    private final Clock clock;

    public PaymentProviderEffectHandler(
        PaymentEffectLedger effects,
        PaymentProvider provider,
        CommandGateway commands,
        Clock clock
    ) {
        this.effects = java.util.Objects.requireNonNull(effects, "effects");
        this.provider = java.util.Objects.requireNonNull(provider, "provider");
        this.commands = java.util.Objects.requireNonNull(commands, "commands");
        this.clock = java.util.Objects.requireNonNull(clock, "clock");
    }

    @EventHandler
    public void on(PaymentRequested event, ProcessingContext context) {
        context.onAfterCommit(ignored -> execute(event));
    }

    @EventHandler
    public void on(PaymentRefundRequested event, ProcessingContext context) {
        context.onAfterCommit(ignored -> execute(event));
    }

    public CompletableFuture<Void> execute(PaymentRequested event) {
        var effectId = effectId(event.operationKey(), event.paymentId(), "PROVIDER_PAYMENT");
        var effect = new PaymentEffectLedger.Effect(
            effectId,
            event.paymentId(),
            event.operationKey(),
            PaymentEffectLedger.Type.PROVIDER_PAYMENT,
            event.occurredAt()
        );
        var result = effectResult(effect, event.providerCommand());
        return commands.send(new RecordPaymentOutcome(
            event.paymentId(), result.providerReference(), result.status(), result.pixCode(),
            event.correlationId(), effectId.toString()
        ), Void.class);
    }

    public CompletableFuture<Void> execute(PaymentRefundRequested event) {
        var effectId = effectId(event.operationKey(), event.paymentId(), "PROVIDER_REFUND");
        var effect = new PaymentEffectLedger.Effect(
            effectId,
            event.paymentId(),
            event.operationKey(),
            PaymentEffectLedger.Type.PROVIDER_REFUND,
            event.occurredAt()
        );
        var result = effectResult(effect, event.providerCommand());
        return commands.send(new RecordPaymentOutcome(
            event.paymentId(), result.providerReference(), result.status(), result.pixCode(),
            event.correlationId(), effectId.toString()
        ), Void.class);
    }

    private PaymentProvider.Result effectResult(
        PaymentEffectLedger.Effect effect,
        dev.desafio.transaction.payment.domain.Payment.Command providerCommand
    ) {
        var completed = effects.completed(effect.effectId());
        if (completed.isPresent()) return completed.orElseThrow();

        var result = effects.claim(effect)
            ? provider.execute(providerCommand)
            : provider.reconcile(providerCommand);
        effects.complete(effect.effectId(), result, clock.instant());
        return result;
    }

    private UUID effectId(String operationKey, String paymentId, String type) {
        return dev.desafio.transaction.payment.domain.Payment.stableUuid(operationKey, paymentId, type);
    }
}
