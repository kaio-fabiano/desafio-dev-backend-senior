package dev.desafio.transaction.payment.adapter.mercadopago;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MercadoPagoPaymentProviderTest {
    private static final Path PROVIDER = Path.of(
        "src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProvider.java"
    );

    @Test
    @DisplayName("AC-160: creation sends the operation key as the provider idempotency key @spec:AC-160")
    void creationUsesTheOperationKey() throws IOException {
        var source = Files.readString(PROVIDER);

        assertTrue(source.contains("Headers.IDEMPOTENCY_KEY"));
        assertTrue(source.contains("requestOptions(command.operationKey())"));
        assertFalse(source.matches("(?s).*(randomUUID|new\\s+Random).*"));
    }

    @Test
    @DisplayName("AC-161: Card creation accepts only a short-lived provider token @spec:AC-161")
    void cardCreationKeepsRawCardDataOut() throws IOException {
        var source = Files.readString(PROVIDER);

        assertTrue(source.contains(".token(command.providerToken())"));
        assertFalse(source.matches(
            "(?is).*(cardNumber|card_number|securityCode|security_code|\\bcvv\\b|\\bcvc\\b|\\bpan\\b).*"
        ));
    }

    @Test
    @DisplayName("AC-162: Pix returns the Mercado Pago reference and copy-and-paste code @spec:AC-162")
    void pixUsesTheProviderResponse() throws IOException {
        var source = Files.readString(PROVIDER);

        assertTrue(source.contains(".paymentMethodId(\"pix\")"));
        assertTrue(source.contains("payment.getId().toString()"));
        assertTrue(source.contains("getTransactionData().getQrCode()"));
        assertFalse(source.contains("PIX-"));
    }

    @Test
    @DisplayName("AC-165: ambiguous creation is retried only with the original key @spec:AC-165")
    void ambiguousCreationDoesNotInventASecondAttempt() throws IOException {
        var source = Files.readString(PROVIDER);

        assertTrue(source.contains("Mercado Pago payment creation failed"));
        assertTrue(source.contains("requestOptions(command.operationKey())"));
        assertFalse(source.matches("(?s).*\\b(for|while)\\s*\\(.*"));
    }

    @Test
    @DisplayName("AC-166: refund uses the original provider reference and operation key @spec:AC-166")
    void refundUsesTheOriginalProviderReference() throws IOException {
        var source = Files.readString(PROVIDER);

        assertTrue(source.contains("providerId(command.providerReference())"));
        assertTrue(source.contains("client.refund(providerId, requestOptions(command.operationKey()))"));
        assertTrue(source.contains("client.get(providerId, requestOptions(null))"));
    }
}
