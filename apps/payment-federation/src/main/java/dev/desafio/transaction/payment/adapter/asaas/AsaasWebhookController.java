package dev.desafio.transaction.payment.adapter.asaas;

import com.fasterxml.jackson.databind.JsonNode;
import dev.desafio.transaction.payment.adapter.axon.AxonProviderNotificationHandler;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import dev.desafio.transaction.payment.configuration.AsaasProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/webhooks/asaas")
@ConditionalOnProperty(prefix = "payment.provider", name = "mode", havingValue = "asaas")
public final class AsaasWebhookController {
    private final NotificationHandler handler;
    private final String webhookToken;

    @Autowired
    public AsaasWebhookController(
        AxonProviderNotificationHandler handler,
        AsaasProperties properties
    ) {
        this(notification -> handler.handle(notification).join(), properties.validatedForWebhook().webhookToken());
    }

    AsaasWebhookController(ProviderNotificationHandler handler, String webhookToken) {
        this(notification -> handler.handle(notification), webhookToken);
    }

    private AsaasWebhookController(NotificationHandler handler, String webhookToken) {
        this.handler = Objects.requireNonNull(handler, "handler");
        if (webhookToken == null || webhookToken.isBlank()) {
            throw new IllegalArgumentException("webhookToken is required");
        }
        this.webhookToken = webhookToken;
    }

    @PostMapping
    public ResponseEntity<Void> receive(
        @RequestHeader(value = "asaas-access-token", required = false) String token,
        @RequestBody JsonNode payload
    ) {
        if (!webhookToken.equals(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        var providerReference = payload.path("payment").path("id").asText(null);
        if (providerReference == null || providerReference.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        var requestId = payload.path("id").asText(UUID.randomUUID().toString());
        handler.handle(new ProviderNotificationHandler.Notification(requestId, providerReference));
        return ResponseEntity.ok().build();
    }

    @FunctionalInterface
    private interface NotificationHandler {
        void handle(ProviderNotificationHandler.Notification notification);
    }
}
