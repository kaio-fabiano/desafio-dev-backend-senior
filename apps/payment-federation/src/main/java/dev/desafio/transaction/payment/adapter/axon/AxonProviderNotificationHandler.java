package dev.desafio.transaction.payment.adapter.axon;

import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.application.command.RecordProviderNotification;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;

import java.time.Clock;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class AxonProviderNotificationHandler {
    private final PaymentProvider provider;
    private final ProviderNotificationHandler.Repository notifications;
    private final CommandGateway commands;
    private final Clock clock;

    public AxonProviderNotificationHandler(
        PaymentProvider provider,
        ProviderNotificationHandler.Repository notifications,
        CommandGateway commands,
        Clock clock
    ) {
        this.provider = Objects.requireNonNull(provider, "provider");
        this.notifications = Objects.requireNonNull(notifications, "notifications");
        this.commands = Objects.requireNonNull(commands, "commands");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public CompletableFuture<ProviderNotificationHandler.Outcome> handle(
        ProviderNotificationHandler.Notification notification
    ) {
        Objects.requireNonNull(notification, "notification");
        var state = provider.findByProviderReference(notification.providerReference());
        if (!notification.providerReference().equals(state.providerReference())) {
            throw new IllegalStateException("provider notification resolved to a different payment");
        }
        var claim = notifications.claimForAxon(
            notification.providerRequestId(), state, clock.instant()
        );
        if (claim.completed()) {
            return CompletableFuture.completedFuture(ProviderNotificationHandler.Outcome.DUPLICATE);
        }
        return commands.send(new RecordProviderNotification(
            claim.paymentId(), notification.providerRequestId(), state.providerReference(),
            state.status(), state.pixCode()
        ), Void.class).thenApply(ignored -> {
            notifications.completeForAxon(
                notification.providerRequestId(), ProviderNotificationHandler.Outcome.APPLIED, clock.instant()
            );
            return ProviderNotificationHandler.Outcome.APPLIED;
        });
    }
}
