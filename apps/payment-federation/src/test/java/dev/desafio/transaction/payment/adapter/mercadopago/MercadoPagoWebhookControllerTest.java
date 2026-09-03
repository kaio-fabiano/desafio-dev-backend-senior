package dev.desafio.transaction.payment.adapter.mercadopago;

import dev.desafio.transaction.payment.application.ProviderNotificationHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class MercadoPagoWebhookControllerTest {
    @Test
    @DisplayName("AC-189: Spring has an explicit constructor for real-provider webhook injection @spec:AC-189")
    void declaresTheProductionConstructorAsTheInjectionPoint() {
        var injectionConstructor = Arrays.stream(MercadoPagoWebhookController.class.getConstructors())
            .filter(constructor -> constructor.isAnnotationPresent(Autowired.class))
            .findFirst()
            .orElseThrow();

        assertEquals(3, injectionConstructor.getParameterCount());
    }

    @Test
    @DisplayName("AC-163: invalid signatures are rejected before replay-safe handling @spec:AC-163")
    void rejectsInvalidSignatureBeforeHandling() {
        var handler = mock(ProviderNotificationHandler.class);
        var controller = new MercadoPagoWebhookController(handler, "webhook-secret");
        var response = controller.receive("ts=123,v1=invalid", "request-1", "42");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verifyNoInteractions(handler);
    }

    @Test
    @DisplayName("AC-163: legacy epoch-second signatures remain fresh and authenticated @spec:AC-163")
    void forwardsAnAuthenticatedLegacyNotification() throws Exception {
        var handler = mock(ProviderNotificationHandler.class);
        var controller = new MercadoPagoWebhookController(handler, "webhook-secret");
        String timestamp = Long.toString(Instant.now().getEpochSecond());
        String signature = signature(timestamp, "request-1", "42");

        var response = controller.receive(signature, "request-1", "42");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(handler).handle(new ProviderNotificationHandler.Notification("request-1", "42"));
    }

    @Test
    void forwardsAnAuthenticatedMillisecondNotification() throws Exception {
        var handler = mock(ProviderNotificationHandler.class);
        var controller = new MercadoPagoWebhookController(handler, "webhook-secret");
        String timestamp = Long.toString(Instant.now().toEpochMilli());

        var response = controller.receive(signature(timestamp, "request-1", "42"), "request-1", "42");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(handler).handle(new ProviderNotificationHandler.Notification("request-1", "42"));
    }

    @Test
    void rejectsAStaleLegacySignature() throws Exception {
        var handler = mock(ProviderNotificationHandler.class);
        var controller = new MercadoPagoWebhookController(handler, "webhook-secret");
        String timestamp = Long.toString(Instant.now().minusSeconds(301).getEpochSecond());

        var response = controller.receive(signature(timestamp, "request-1", "42"), "request-1", "42");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verifyNoInteractions(handler);
    }

    private static String signature(String timestamp, String requestId, String reference) throws Exception {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("webhook-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal(
            ("id:" + reference + ";request-id:" + requestId + ";ts:" + timestamp + ";")
                .getBytes(StandardCharsets.UTF_8)
        );
        return "ts=" + timestamp + ",v1=" + java.util.HexFormat.of().formatHex(digest);
    }
}
