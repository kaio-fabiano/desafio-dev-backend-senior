package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

public final class ProviderNotificationHandler {
    private final PaymentProvider provider;
    private final Repository repository;
    private final Clock clock;

    public ProviderNotificationHandler(PaymentProvider provider, Repository repository) {
        this(provider, repository, Clock.systemUTC());
    }

    ProviderNotificationHandler(PaymentProvider provider, Repository repository, Clock clock) {
        this.provider = Objects.requireNonNull(provider, "provider");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public Outcome handle(Notification notification) {
        Objects.requireNonNull(notification, "notification");
        var authoritativeState = provider.findByProviderReference(notification.providerReference());
        if (!notification.providerReference().equals(authoritativeState.providerReference())) {
            throw new IllegalStateException(PaymentErrorMessages.PROVIDER_NOTIFICATION_RESOLVED_TO_A_DIFFERENT_PAYMENT);
        }
        return repository.apply(notification.providerRequestId(), authoritativeState, clock.instant());
    }

    public record Notification(String providerRequestId, String providerReference) {
        public Notification {
            providerRequestId = requireText(providerRequestId, "providerRequestId");
            providerReference = requireText(providerReference, "providerReference");
        }
    }

    public interface Repository {
        Outcome apply(
            String providerRequestId,
            PaymentProvider.Result authoritativeState,
            Instant receivedAt
        );

        default Claim claimForAxon(
            String providerRequestId,
            PaymentProvider.Result authoritativeState,
            Instant receivedAt
        ) {
            throw new UnsupportedOperationException(PaymentErrorMessages.AXON_NOTIFICATION_CLAIMS_ARE_NOT_SUPPORTED);
        }

        default void completeForAxon(String providerRequestId, Outcome outcome, Instant processedAt) {
            throw new UnsupportedOperationException(PaymentErrorMessages.AXON_NOTIFICATION_COMPLETION_IS_NOT_SUPPORTED);
        }
    }

    public record Claim(String paymentId, boolean completed) {}

    public enum Outcome {
        APPLIED,
        DUPLICATE,
        NO_CHANGE,
        IGNORED
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required(name));
        }
        return value;
    }
}
