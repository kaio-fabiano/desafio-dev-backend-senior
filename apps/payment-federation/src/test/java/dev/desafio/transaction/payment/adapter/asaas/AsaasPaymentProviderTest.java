package dev.desafio.transaction.payment.adapter.asaas;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.payment.configuration.AsaasProperties;
import dev.desafio.transaction.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AsaasPaymentProviderTest {
    private static final Instant NOW = Instant.parse("2026-09-12T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    @DisplayName("Pix creation creates a customer and returns the generated code")
    void pixCreationReturnsTheGeneratedCode() {
        var client = mock(AsaasHttpClient.class);
        when(client.properties()).thenReturn(properties());
        when(client.get("/payments?externalReference=payment%3Apix-1")).thenReturn(emptyPage());
        when(client.get("/customers?email=buyer%40example.test")).thenReturn(emptyPage());
        when(client.post(eq("/customers"), any())).thenReturn(node(Map.of("id", "cus_1")));
        when(client.post(eq("/payments"), any())).thenReturn(
            node(Map.of("id", "pay_1", "billingType", "PIX", "status", "PENDING"))
        );
        when(client.get("/payments/pay_1/pixQrCode")).thenReturn(node(Map.of("payload", "pix-copy-paste-code")));
        var provider = new AsaasPaymentProvider(client, CLOCK);

        var result = provider.execute(pixRequest());

        assertEquals("pay_1", result.providerReference());
        assertEquals(Payment.Status.PIX_GENERATED, result.status());
        assertEquals("pix-copy-paste-code", result.pixCode());

        var body = ArgumentCaptor.forClass(Map.class);
        verify(client).post(eq("/payments"), body.capture());
        assertEquals("PIX", body.getValue().get("billingType"));
        assertEquals("cus_1", body.getValue().get("customer"));
        assertEquals("payment:pix-1", body.getValue().get("externalReference"));
    }

    @Test
    @DisplayName("A settled Pix payment reports PIX_PAID with no code")
    void settledPixPaymentReportsPixPaid() {
        var client = mock(AsaasHttpClient.class);
        when(client.get("/payments/pay_1")).thenReturn(
            node(Map.of("id", "pay_1", "billingType", "PIX", "status", "RECEIVED_IN_CASH"))
        );
        var provider = new AsaasPaymentProvider(client, CLOCK);

        var result = provider.findByProviderReference("pay_1");

        assertEquals("pay_1", result.providerReference());
        assertEquals(Payment.Status.PIX_PAID, result.status());
        assertNull(result.pixCode());
    }

    @Test
    @DisplayName("Card creation reuses an existing customer and sends the provider token")
    void cardCreationReusesExistingCustomer() {
        var client = mock(AsaasHttpClient.class);
        when(client.properties()).thenReturn(properties());
        when(client.get("/payments?externalReference=payment%3Acard-1")).thenReturn(emptyPage());
        when(client.get("/customers?email=buyer%40example.test")).thenReturn(
            node(Map.of("data", java.util.List.of(Map.of("id", "cus_existing"))))
        );
        when(client.post(eq("/payments"), any())).thenReturn(
            node(Map.of("id", "pay_2", "billingType", "CREDIT_CARD", "status", "CONFIRMED"))
        );
        var provider = new AsaasPaymentProvider(client, CLOCK);

        var result = provider.execute(cardRequest());

        assertEquals("pay_2", result.providerReference());
        assertEquals(Payment.Status.AUTHORIZED, result.status());
        assertNull(result.pixCode());
        verify(client, never()).post(eq("/customers"), any());

        var body = ArgumentCaptor.forClass(Map.class);
        verify(client).post(eq("/payments"), body.capture());
        assertEquals("CREDIT_CARD", body.getValue().get("billingType"));
        assertEquals("cus_existing", body.getValue().get("customer"));
        assertEquals("short-lived-token", body.getValue().get("creditCardToken"));
    }

    @Test
    @DisplayName("Refund calls the Asaas refund endpoint and reports REFUNDED")
    void refundReportsRefunded() {
        var client = mock(AsaasHttpClient.class);
        when(client.post(eq("/payments/pay_2/refund"), any())).thenReturn(node(Map.of()));
        when(client.get("/payments/pay_2")).thenReturn(
            node(Map.of("id", "pay_2", "billingType", "CREDIT_CARD", "status", "REFUNDED"))
        );
        var provider = new AsaasPaymentProvider(client, CLOCK);

        var result = provider.execute(new Payment.RefundRequested(
            "operation-refund", "payment-card", "order-card", "buyer-request", "pay_2"
        ));

        verify(client).post(eq("/payments/pay_2/refund"), any());
        assertEquals(Payment.Status.REFUNDED, result.status());
        assertEquals("pay_2", result.providerReference());
    }

    @Test
    @DisplayName("A repeated creation is recovered from Asaas without a new payment")
    void repeatedCreationIsRecoveredWithoutANewPayment() {
        var client = mock(AsaasHttpClient.class);
        when(client.get("/payments?externalReference=payment%3Apix-1")).thenReturn(
            node(Map.of("data", java.util.List.of(Map.of("id", "pay_1", "billingType", "PIX", "status", "PENDING"))))
        );
        when(client.get("/payments/pay_1/pixQrCode")).thenReturn(node(Map.of("payload", "pix-copy-paste-code")));
        var provider = new AsaasPaymentProvider(client, CLOCK);

        var result = provider.execute(pixRequest());

        assertEquals("pay_1", result.providerReference());
        verify(client, never()).post(eq("/payments"), any());
        verify(client, never()).post(eq("/customers"), any());
    }

    private Payment.PaymentRequested pixRequest() {
        return new Payment.PaymentRequested(
            "operation-pix", "payment:pix-1", "order-pix", Payment.Method.PIX,
            new BigDecimal("42.50"), "BRL", null, "buyer@example.test", null
        );
    }

    private Payment.PaymentRequested cardRequest() {
        return new Payment.PaymentRequested(
            "operation-card", "payment:card-1", "order-card", Payment.Method.CARD,
            new BigDecimal("42.50"), "BRL", "short-lived-token", "buyer@example.test", "card"
        );
    }

    private AsaasProperties properties() {
        return new AsaasProperties(
            "api-key",
            URI.create("https://api-sandbox.asaas.com/v3"),
            "24971563792",
            "webhook-token",
            Duration.ofSeconds(5),
            Duration.ofSeconds(15)
        );
    }

    private JsonNode emptyPage() {
        return node(Map.of("data", java.util.List.of()));
    }

    private JsonNode node(Map<String, ?> value) {
        return JSON.valueToTree(value);
    }
}
