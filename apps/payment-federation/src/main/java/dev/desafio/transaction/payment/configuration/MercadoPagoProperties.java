package dev.desafio.transaction.payment.configuration;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.time.Duration;

@ConfigurationProperties("payment.provider")
public record MercadoPagoProperties(
    Mode mode,
    String accessToken,
    String webhookSecret,
    URI apiBaseUrl,
    Duration connectionTimeout,
    Duration readTimeout
) {
    private static final URI OFFICIAL_API_BASE_URL = URI.create("https://api.mercadopago.com");
    private static final Duration MAXIMUM_TIMEOUT = Duration.ofSeconds(60);

    public MercadoPagoProperties validatedForMercadoPago() {
        if (mode != Mode.MERCADO_PAGO) {
            throw new IllegalStateException(PaymentErrorMessages.PAYMENT_PROVIDER_MODE_MUST_BE_MERCADO_PAGO);
        }
        requireText(accessToken, "payment.provider.access-token");
        requireText(webhookSecret, "payment.provider.webhook-secret");
        requireOfficialEndpoint(apiBaseUrl, "payment.provider.api-base-url");
        requirePositive(connectionTimeout, "payment.provider.connection-timeout");
        requirePositive(readTimeout, "payment.provider.read-timeout");
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

    private static void requireOfficialEndpoint(URI value, String name) {
        if (!OFFICIAL_API_BASE_URL.equals(value)) {
            throw new IllegalStateException(PaymentErrorMessages.mustBe(name, OFFICIAL_API_BASE_URL));
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

    public enum Mode {
        DETERMINISTIC,
        MERCADO_PAGO
    }
}
