package dev.desafio.transaction.payment.adapter.mercadopago;

import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.payment.PaymentCreateRequest;
import com.mercadopago.core.MPRequestOptions;
import com.mercadopago.net.Headers;
import com.mercadopago.resources.payment.PaymentPointOfInteraction;
import com.mercadopago.resources.payment.PaymentTransactionData;
import dev.desafio.transaction.payment.configuration.MercadoPagoProperties;
import dev.desafio.transaction.payment.domain.Payment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MercadoPagoPaymentProviderTest {
    @Test
    @DisplayName("AC-160: creation sends the operation key as the provider idempotency key @spec:AC-160")
    void creationUsesTheOperationKey() throws Exception {
        var client = mock(PaymentClient.class);
        var payment = providerPayment(42L, "approved", null);
        when(client.create(any(), any())).thenReturn(payment);
        var provider = new MercadoPagoPaymentProvider(client, properties());

        provider.execute(cardRequest());

        var options = ArgumentCaptor.forClass(MPRequestOptions.class);
        verify(client).create(any(PaymentCreateRequest.class), options.capture());
        assertEquals("operation-card", options.getValue().getCustomHeaders().get(Headers.IDEMPOTENCY_KEY));
    }

    @Test
    @DisplayName("AC-161: Card creation accepts only a short-lived provider token @spec:AC-161")
    void cardCreationUsesTheProviderToken() throws Exception {
        var client = mock(PaymentClient.class);
        var payment = providerPayment(42L, "approved", null);
        when(client.create(any(), any())).thenReturn(payment);
        var provider = new MercadoPagoPaymentProvider(client, properties());

        provider.execute(cardRequest());

        var request = ArgumentCaptor.forClass(PaymentCreateRequest.class);
        verify(client).create(request.capture(), any());
        assertEquals("short-lived-token", request.getValue().getToken());
        assertEquals("visa", request.getValue().getPaymentMethodId());
        assertEquals("buyer@example.test", request.getValue().getPayer().getEmail());
        assertEquals(1, request.getValue().getInstallments());
    }

    @Test
    @DisplayName("AC-162: Pix returns the Mercado Pago reference and copy-and-paste code @spec:AC-162")
    void pixUsesTheProviderResponse() throws Exception {
        var client = mock(PaymentClient.class);
        var payment = providerPayment(84L, "pending", "provider-pix-code");
        when(client.create(any(), any())).thenReturn(payment);
        var provider = new MercadoPagoPaymentProvider(client, properties());

        var result = provider.execute(pixRequest());

        var request = ArgumentCaptor.forClass(PaymentCreateRequest.class);
        verify(client).create(request.capture(), any());
        assertEquals("pix", request.getValue().getPaymentMethodId());
        assertNull(request.getValue().getToken());
        assertEquals("84", result.providerReference());
        assertEquals(Payment.Status.PIX_GENERATED, result.status());
        assertEquals("provider-pix-code", result.pixCode());
    }

    @Test
    @DisplayName("AC-165: ambiguous creation is retried only with the original key @spec:AC-165")
    void repeatedCreationKeepsTheOriginalKey() throws Exception {
        var client = mock(PaymentClient.class);
        var payment = providerPayment(42L, "approved", null);
        when(client.create(any(), any())).thenReturn(payment);
        var provider = new MercadoPagoPaymentProvider(client, properties());

        provider.execute(cardRequest());
        provider.execute(cardRequest());

        var options = ArgumentCaptor.forClass(MPRequestOptions.class);
        verify(client, times(2)).create(any(), options.capture());
        assertEquals(
            java.util.List.of("operation-card", "operation-card"),
            options.getAllValues().stream()
                .map(value -> value.getCustomHeaders().get(Headers.IDEMPOTENCY_KEY))
                .toList()
        );
    }

    @Test
    @DisplayName("AC-166: refund uses the original provider reference and operation key @spec:AC-166")
    void refundUsesTheOriginalProviderReference() throws Exception {
        var client = mock(PaymentClient.class);
        var payment = providerPayment(42L, "refunded", null);
        when(client.get(any(), any())).thenReturn(payment);
        var provider = new MercadoPagoPaymentProvider(client, properties());
        var command = new Payment.RefundRequested(
            "operation-refund", "payment-card", "order-card", "buyer-request", "42"
        );

        var result = provider.execute(command);

        var options = ArgumentCaptor.forClass(MPRequestOptions.class);
        verify(client).refund(org.mockito.ArgumentMatchers.eq(42L), options.capture());
        verify(client).get(org.mockito.ArgumentMatchers.eq(42L), any());
        assertEquals("operation-refund", options.getValue().getCustomHeaders().get(Headers.IDEMPOTENCY_KEY));
        assertEquals(Payment.Status.REFUNDED, result.status());
    }

    @Test
    void rejectsUnsupportedCurrencyBeforeCallingTheProvider() {
        var client = mock(PaymentClient.class);
        var provider = new MercadoPagoPaymentProvider(client, properties());
        var request = new Payment.PaymentRequested(
            "operation-usd", "payment-usd", "order-usd", Payment.Method.CARD,
            new BigDecimal("10.00"), "USD", "token", "buyer@example.test", "visa"
        );

        assertThrows(IllegalArgumentException.class, () -> provider.execute(request));
    }

    private Payment.PaymentRequested cardRequest() {
        return new Payment.PaymentRequested(
            "operation-card", "payment-card", "order-card", Payment.Method.CARD,
            new BigDecimal("42.50"), "BRL", "short-lived-token", "buyer@example.test", "visa"
        );
    }

    private Payment.PaymentRequested pixRequest() {
        return new Payment.PaymentRequested(
            "operation-pix", "payment-pix", "order-pix", Payment.Method.PIX,
            new BigDecimal("42.50"), "BRL", null, "buyer@example.test", null
        );
    }

    private MercadoPagoProperties properties() {
        return new MercadoPagoProperties(
            MercadoPagoProperties.Mode.MERCADO_PAGO,
            "access-token",
            "webhook-secret",
            URI.create("https://api.mercadopago.com"),
            Duration.ofSeconds(2),
            Duration.ofSeconds(5)
        );
    }

    private com.mercadopago.resources.payment.Payment providerPayment(
        Long id,
        String status,
        String pixCode
    ) {
        var payment = mock(com.mercadopago.resources.payment.Payment.class);
        when(payment.getId()).thenReturn(id);
        when(payment.getStatus()).thenReturn(status);
        if (pixCode != null) {
            var interaction = mock(PaymentPointOfInteraction.class);
            var transaction = mock(PaymentTransactionData.class);
            when(payment.getPointOfInteraction()).thenReturn(interaction);
            when(interaction.getTransactionData()).thenReturn(transaction);
            when(transaction.getQrCode()).thenReturn(pixCode);
        }
        return payment;
    }
}
