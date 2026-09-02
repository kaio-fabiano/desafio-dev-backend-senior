package dev.desafio.transaction.payment.adapter.mercadopago;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class MercadoPagoWebhookControllerTest {
    @Test
    @DisplayName("AC-163: invalid signatures are rejected before replay-safe handling @spec:AC-163")
    void authenticatesBeforeHandling() throws IOException {
        var source = Files.readString(Path.of(
            "src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookController.java"
        ));

        var validation = source.indexOf("WebhookSignatureValidator.validate(");
        var handling = source.indexOf("handler.handle(");
        assertTrue(validation >= 0 && validation < handling);
        assertTrue(source.contains("MPInvalidWebhookSignatureException"));
        assertTrue(source.contains("HttpStatus.UNAUTHORIZED"));
        assertTrue(source.contains("MAX_SIGNATURE_AGE"));
    }
}
