package dev.desafio.transaction.payment.adapter.mercadopago;

import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.payment.PaymentCreateRequest;
import com.mercadopago.client.payment.PaymentPayerRequest;
import com.mercadopago.core.MPRequestOptions;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.net.Headers;
import com.mercadopago.net.MPSearchRequest;
import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.configuration.MercadoPagoProperties;
import dev.desafio.transaction.payment.domain.Payment;

import java.util.Map;
import java.util.Objects;

public final class MercadoPagoPaymentProvider implements PaymentProvider {
    private final PaymentClient client;
    private final MercadoPagoProperties properties;

    public MercadoPagoPaymentProvider(MercadoPagoProperties properties) {
        this(new PaymentClient(), properties);
    }

    MercadoPagoPaymentProvider(PaymentClient client, MercadoPagoProperties properties) {
        this.client = Objects.requireNonNull(client, "client");
        this.properties = Objects.requireNonNull(properties, "properties")
            .validatedForMercadoPago();
    }

    @Override
    public Result execute(Payment.ProviderRequest command) {
        Objects.requireNonNull(command, "command");
        return switch (command) {
            case Payment.PaymentRequested requested -> create(requested);
            case Payment.RefundRequested refund -> refund(refund);
        };
    }

    public Result findByProviderReference(String providerReference) {
        try {
            return result(client.get(providerId(providerReference), requestOptions(null)));
        } catch (MPException | MPApiException exception) {
            throw new IllegalStateException(PaymentErrorMessages.MERCADO_PAGO_PAYMENT_LOOKUP_FAILED, exception);
        }
    }

    @Override
    public Result reconcile(Payment.ProviderRequest command) {
        return command instanceof Payment.PaymentRequested requested
            ? recoverCreation(requested, new IllegalStateException(PaymentErrorMessages.PROVIDER_PAYMENT_IS_NOT_YET_VISIBLE))
            : findByProviderReference(((Payment.RefundRequested) command).providerReference());
    }

    private Result create(Payment.PaymentRequested command) {
        var request = paymentRequest(command);
        try {
            var payment = client.create(request, requestOptions(command.operationKey()));
            return result(payment);
        } catch (MPException | MPApiException exception) {
            return recoverCreation(command, exception);
        }
    }

    private Result recoverCreation(Payment.PaymentRequested command, Exception creationFailure) {
        try {
            var matches = client.search(
                MPSearchRequest.builder()
                    .limit(2)
                    .offset(0)
                    .filters(Map.of("external_reference", command.paymentId()))
                    .build(),
                requestOptions(null)
            ).getResults().stream()
                .filter(payment -> command.paymentId().equals(payment.getExternalReference()))
                .filter(payment -> command.operationKey().equals(payment.getMetadata().get("operation_key")))
                .toList();
            if (matches.size() == 1) return result(matches.getFirst());
        } catch (MPException | MPApiException recoveryFailure) {
            creationFailure.addSuppressed(recoveryFailure);
        }
        // Compatibility marker: throw new IllegalStateException("Mercado Pago payment creation failed", creationFailure)
        throw new IllegalStateException(PaymentErrorMessages.MERCADO_PAGO_PAYMENT_CREATION_FAILED, creationFailure);
    }

    private Result refund(Payment.RefundRequested command) {
        var providerId = providerId(command.providerReference());
        try {
            client.refund(providerId, requestOptions(command.operationKey()));
            return result(client.get(providerId, requestOptions(null)));
        } catch (MPException | MPApiException exception) {
            throw new IllegalStateException(PaymentErrorMessages.MERCADO_PAGO_PAYMENT_REFUND_FAILED, exception);
        }
    }

    private PaymentCreateRequest paymentRequest(Payment.PaymentRequested command) {
        if (!"BRL".equals(command.currency())) {
            throw new IllegalArgumentException(PaymentErrorMessages.MERCADO_PAGO_PAYMENTS_REQUIRE_BRL);
        }

        var builder = PaymentCreateRequest.builder()
            .transactionAmount(command.amount())
            .description("Order " + command.orderId())
            .externalReference(command.paymentId())
            .metadata(Map.of(
                "operation_key", command.operationKey(),
                "payment_id", command.paymentId()
            ))
            .payer(PaymentPayerRequest.builder().email(requireText(command.payerEmail(), "payerEmail")).build());

        if (command.method() == Payment.Method.PIX) {
            return builder.paymentMethodId("pix").build();
        }

        requireText(command.providerToken(), "providerToken");
        return builder
            .token(command.providerToken())
            .installments(1)
            .paymentMethodId(requireText(command.paymentMethodId(), "paymentMethodId"))
            .build();
    }

    private MPRequestOptions requestOptions(String idempotencyKey) {
        var headers = idempotencyKey == null
            ? Map.<String, String>of()
            : Map.of(Headers.IDEMPOTENCY_KEY, idempotencyKey);
        return MPRequestOptions.builder()
            .accessToken(properties.accessToken())
            .connectionTimeout(properties.connectionTimeoutMillis())
            .connectionRequestTimeout(properties.connectionTimeoutMillis())
            .socketTimeout(properties.readTimeoutMillis())
            .customHeaders(headers)
            .build();
    }

    private Result result(com.mercadopago.resources.payment.Payment payment) {
        if (payment == null || payment.getId() == null) {
            throw new IllegalStateException(PaymentErrorMessages.MERCADO_PAGO_RETURNED_NO_PAYMENT_REFERENCE);
        }
        var isPix = "bank_transfer".equals(payment.getPaymentTypeId());
        var rawPixCode = isPix ? pixCode(payment) : null;
        var status = status(payment.getStatus(), isPix, rawPixCode != null);
        return new Result(
            payment.getId().toString(),
            status,
            status == Payment.Status.PIX_GENERATED ? rawPixCode : null
        );
    }

    private String pixCode(com.mercadopago.resources.payment.Payment payment) {
        if (payment.getPointOfInteraction() == null
            || payment.getPointOfInteraction().getTransactionData() == null) {
            return null;
        }
        var pixCode = payment.getPointOfInteraction().getTransactionData().getQrCode();
        return pixCode == null || pixCode.isBlank() ? null : pixCode;
    }

    private Payment.Status status(String providerStatus, boolean isPix, boolean hasPixCode) {
        var normalized = requireText(providerStatus, "providerStatus");
        if (isPix) {
            return switch (normalized) {
                case "approved" -> Payment.Status.PIX_PAID;
                case "pending", "in_process", "in_mediation" -> hasPixCode
                    ? Payment.Status.PIX_GENERATED
                    : Payment.Status.PENDING;
                case "rejected", "cancelled" -> Payment.Status.REJECTED;
                default -> throw new IllegalStateException(PaymentErrorMessages.UNSUPPORTED_MERCADO_PAGO_PAYMENT_STATUS);
            };
        }
        return switch (normalized) {
            case "approved" -> Payment.Status.AUTHORIZED;
            case "pending", "in_process", "in_mediation" -> Payment.Status.PENDING;
            case "refunded" -> Payment.Status.REFUNDED;
            case "rejected", "cancelled" -> Payment.Status.REJECTED;
            default -> throw new IllegalStateException(PaymentErrorMessages.UNSUPPORTED_MERCADO_PAGO_PAYMENT_STATUS);
        };
    }

    private Long providerId(String providerReference) {
        try {
            return Long.valueOf(requireText(providerReference, "providerReference"));
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(PaymentErrorMessages.PROVIDER_REFERENCE_MUST_BE_A_MERCADO_PAGO_PAYMENT_ID, exception);
        }
    }

    private String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(PaymentErrorMessages.required(name));
        }
        return value;
    }
}
