package dev.desafio.transaction.payment.adapter.asaas;

import com.fasterxml.jackson.databind.JsonNode;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.configuration.AsaasProperties;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.payment.domain.PaymentErrorMessages;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public final class AsaasPaymentProvider implements PaymentProvider {
    private final AsaasHttpClient client;
    private final Clock clock;

    public AsaasPaymentProvider(AsaasProperties properties) {
        this(new AsaasHttpClient(properties.validatedForAsaas()), Clock.systemUTC());
    }

    AsaasPaymentProvider(AsaasHttpClient client, Clock clock) {
        this.client = Objects.requireNonNull(client, "client");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public Result execute(Payment.ProviderRequest command) {
        Objects.requireNonNull(command, "command");
        return switch (command) {
            case Payment.PaymentRequested requested -> create(requested);
            case Payment.RefundRequested refund -> refund(refund);
        };
    }

    @Override
    public Result findByProviderReference(String providerReference) {
        return resultFromPayment(client.get("/payments/" + providerReference));
    }

    private Result create(Payment.PaymentRequested command) {
        if (!"BRL".equals(command.currency())) {
            throw new IllegalArgumentException(PaymentErrorMessages.ASAAS_PAYMENTS_REQUIRE_BRL);
        }
        try {
            var existing = findByExternalReference(command.paymentId());
            if (existing != null) return resultFromPayment(existing);

            var customerId = findOrCreateCustomer(command.payerEmail());
            var body = new LinkedHashMap<String, Object>();
            body.put("customer", customerId);
            body.put("value", command.amount());
            body.put("dueDate", LocalDate.now(clock).plusDays(1).toString());
            body.put("description", "Order " + command.orderId());
            body.put("externalReference", command.paymentId());
            if (command.method() == Payment.Method.PIX) {
                body.put("billingType", "PIX");
            } else {
                body.put("billingType", "CREDIT_CARD");
                body.put("creditCardToken", requireText(command.providerToken(), "providerToken"));
            }
            var payment = client.post("/payments", body);
            return resultFromPayment(payment);
        } catch (RuntimeException failure) {
            var recovered = findByExternalReference(command.paymentId());
            if (recovered != null) return resultFromPayment(recovered);
            throw new IllegalStateException(PaymentErrorMessages.ASAAS_PAYMENT_CREATION_FAILED, failure);
        }
    }

    private Result refund(Payment.RefundRequested command) {
        try {
            client.post("/payments/" + command.providerReference() + "/refund", Map.of());
            return findByProviderReference(command.providerReference());
        } catch (RuntimeException failure) {
            throw new IllegalStateException(PaymentErrorMessages.ASAAS_PAYMENT_REFUND_FAILED, failure);
        }
    }

    private JsonNode findByExternalReference(String paymentId) {
        var page = client.get("/payments?externalReference=" + encode(paymentId));
        var data = page.path("data");
        return data.isArray() && !data.isEmpty() ? data.get(0) : null;
    }

    private String findOrCreateCustomer(String email) {
        try {
            var page = client.get("/customers?email=" + encode(email));
            var data = page.path("data");
            if (data.isArray() && !data.isEmpty()) {
                return textOrNull(data.get(0), "id");
            }
            var created = client.post("/customers", Map.of(
                "name", email,
                "email", email,
                "cpfCnpj", client.properties().customerDocument()
            ));
            var id = textOrNull(created, "id");
            if (id == null) throw new IllegalStateException(PaymentErrorMessages.ASAAS_CUSTOMER_CREATION_FAILED);
            return id;
        } catch (RuntimeException failure) {
            throw new IllegalStateException(PaymentErrorMessages.ASAAS_CUSTOMER_LOOKUP_FAILED, failure);
        }
    }

    private Result resultFromPayment(JsonNode payment) {
        var id = textOrNull(payment, "id");
        if (id == null) {
            throw new IllegalStateException(PaymentErrorMessages.ASAAS_RETURNED_NO_PAYMENT_REFERENCE);
        }
        var billingType = textOrNull(payment, "billingType");
        var asaasStatus = textOrNull(payment, "status");
        var isPix = "PIX".equals(billingType);
        var status = status(asaasStatus, isPix);
        var pixCode = status == Payment.Status.PIX_GENERATED ? pixCode(id) : null;
        return new Result(id, status, pixCode);
    }

    private String pixCode(String paymentId) {
        try {
            var qrCode = client.get("/payments/" + paymentId + "/pixQrCode");
            return textOrNull(qrCode, "payload");
        } catch (RuntimeException failure) {
            return null;
        }
    }

    private Payment.Status status(String asaasStatus, boolean isPix) {
        var normalized = asaasStatus == null ? "" : asaasStatus;
        if (isPix) {
            return switch (normalized) {
                case "PENDING", "AWAITING_RISK_ANALYSIS" -> Payment.Status.PIX_GENERATED;
                case "CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH" -> Payment.Status.PIX_PAID;
                case "OVERDUE", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE" -> Payment.Status.REJECTED;
                default -> throw new IllegalStateException(
                    PaymentErrorMessages.UNSUPPORTED_ASAAS_PAYMENT_STATUS + ": " + asaasStatus
                );
            };
        }
        return switch (normalized) {
            case "CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH" -> Payment.Status.AUTHORIZED;
            case "PENDING", "AWAITING_RISK_ANALYSIS" -> Payment.Status.PENDING;
            case "REFUNDED" -> Payment.Status.REFUNDED;
            case "OVERDUE", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE" -> Payment.Status.REJECTED;
            default -> throw new IllegalStateException(
                PaymentErrorMessages.UNSUPPORTED_ASAAS_PAYMENT_STATUS + ": " + asaasStatus
            );
        };
    }

    private String textOrNull(JsonNode node, String field) {
        var value = node.path(field);
        return value.isTextual() ? value.asText() : null;
    }

    private String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required(name));
        }
        return value;
    }

    private String encode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}
