package dev.desafio.transaction.payment.configuration;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.time.Duration;

@ConfigurationProperties("payment.asaas")
public record AsaasProperties(
    String apiKey,
    URI apiBaseUrl,
    String customerDocument,
    String webhookToken,
    Duration connectionTimeout,
    Duration readTimeout
) {
    private static final Duration MAXIMUM_TIMEOUT = Duration.ofSeconds(60);

    public AsaasProperties validatedForAsaas() {
        requireText(apiKey, "payment.asaas.api-key");
        if (apiBaseUrl == null) {
            throw new IllegalStateException(PaymentErrorMessages.required("payment.asaas.api-base-url"));
        }
        requireText(customerDocument, "payment.asaas.customer-document");
        requirePositive(connectionTimeout, "payment.asaas.connection-timeout");
        requirePositive(readTimeout, "payment.asaas.read-timeout");
        return this;
    }

    public AsaasProperties validatedForWebhook() {
        requireText(webhookToken, "payment.asaas.webhook-token");
        return this;
    }

    public int connectionTimeoutMillis() {
        return Math.toIntExact(connectionTimeout.toMillis());
    }

    public int readTimeoutMillis() {
        return Math.toIntExact(readTimeout.toMillis());
    }

    private static void requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(PaymentErrorMessages.required(name));
        }
    }

    private static void requirePositive(Duration value, String name) {
        if (value == null
            || value.isZero()
            || value.isNegative()
            || value.compareTo(MAXIMUM_TIMEOUT) > 0) {
            throw new IllegalStateException(PaymentErrorMessages.timeoutMustBeValid(name));
        }
    }
}
