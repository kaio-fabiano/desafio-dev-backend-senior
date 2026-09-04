package dev.desafio.transaction.payment.adapter.mercadopago;

import com.mercadopago.exceptions.MPInvalidWebhookSignatureException;
import com.mercadopago.webhook.WebhookSignatureValidator;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.configuration.MercadoPagoProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;

@RestController
@RequestMapping("/webhooks/mercado-pago")
@ConditionalOnProperty(prefix = "payment.provider", name = "mode", havingValue = "mercado-pago")
public final class MercadoPagoWebhookController {
    private static final Duration MAX_SIGNATURE_AGE = Duration.ofMinutes(5);

    private final ProviderNotificationHandler handler;
    private final String webhookSecret;

    @Autowired
    public MercadoPagoWebhookController(
        PaymentProvider provider,
        ProviderNotificationHandler.Repository repository,
        MercadoPagoProperties properties
    ) {
        this(new ProviderNotificationHandler(provider, repository), properties.webhookSecret());
    }

    MercadoPagoWebhookController(ProviderNotificationHandler handler, String webhookSecret) {
        this.handler = java.util.Objects.requireNonNull(handler, "handler");
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new IllegalArgumentException("webhookSecret is required");
        }
        this.webhookSecret = webhookSecret;
    }

    @PostMapping
    public ResponseEntity<Void> receive(
        @RequestHeader("x-signature") String signature,
        @RequestHeader("x-request-id") String providerRequestId,
        @RequestParam("data.id") String providerReference
    ) {
        try {
            validateSignature(signature, providerRequestId, providerReference);
            handler.handle(new ProviderNotificationHandler.Notification(
                providerRequestId,
                providerReference
            ));
            return ResponseEntity.ok().build();
        } catch (MPInvalidWebhookSignatureException invalidSignature) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    private void validateSignature(String signature, String requestId, String reference)
        throws MPInvalidWebhookSignatureException {
        WebhookSignatureValidator.validate(signature, requestId, reference, webhookSecret);

        String timestamp = null;
        for (String part : signature.split(",")) {
            String[] entry = part.trim().split("=", 2);
            if (entry.length == 2 && "ts".equalsIgnoreCase(entry[0].trim())) {
                timestamp = entry[1].trim();
            }
        }

        try {
            long value = Long.parseLong(timestamp);
            long timestampMillis = timestamp.length() <= 10 ? Math.multiplyExact(value, 1_000L) : value;
            long drift = Math.abs(Math.subtractExact(Instant.now().toEpochMilli(), timestampMillis));
            if (drift > MAX_SIGNATURE_AGE.toMillis()) {
                throw new MPInvalidWebhookSignatureException(
                    com.mercadopago.exceptions.SignatureFailureReason.TIMESTAMP_OUT_OF_TOLERANCE,
                    requestId,
                    timestamp
                );
            }
        } catch (ArithmeticException | NumberFormatException | NullPointerException invalidTimestamp) {
            throw new MPInvalidWebhookSignatureException(
                com.mercadopago.exceptions.SignatureFailureReason.MALFORMED_SIGNATURE_HEADER,
                requestId,
                timestamp
            );
        }
    }
}
