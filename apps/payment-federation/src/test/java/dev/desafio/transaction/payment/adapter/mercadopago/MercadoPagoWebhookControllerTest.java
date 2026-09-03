package dev.desafio.transaction.payment.adapter.mercadopago;

import com.mercadopago.exceptions.MPInvalidWebhookSignatureException;
import com.mercadopago.exceptions.SignatureFailureReason;
import com.mercadopago.webhook.WebhookSignatureValidator;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class MercadoPagoWebhookControllerTest {
    @Test
    @DisplayName("AC-163: invalid signatures are rejected before replay-safe handling @spec:AC-163")
    void rejectsInvalidSignatureBeforeHandling() {
        var handler = mock(ProviderNotificationHandler.class);
        var controller = new MercadoPagoWebhookController(handler, "webhook-secret");
        try (var validator = mockStatic(WebhookSignatureValidator.class)) {
            validator.when(() -> WebhookSignatureValidator.validate(
                "invalid", "request-1", "42", "webhook-secret", java.time.Duration.ofMinutes(5)
            )).thenThrow(new MPInvalidWebhookSignatureException(
                SignatureFailureReason.SIGNATURE_MISMATCH,
                "request-1",
                "123"
            ));

            var response = controller.receive("invalid", "request-1", "42");

            assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
            verifyNoInteractions(handler);
        }
    }

    @Test
    void forwardsAnAuthenticatedNotification() {
        var handler = mock(ProviderNotificationHandler.class);
        var controller = new MercadoPagoWebhookController(handler, "webhook-secret");
        try (var ignored = mockStatic(WebhookSignatureValidator.class)) {
            var response = controller.receive("valid", "request-1", "42");

            assertEquals(HttpStatus.OK, response.getStatusCode());
            verify(handler).handle(new ProviderNotificationHandler.Notification("request-1", "42"));
        }
    }
}
