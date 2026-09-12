package dev.desafio.transaction.payment.domain;

public final class PaymentErrorMessages {
    public static final String AMOUNT_MUST_BE_POSITIVE = "amount must be positive";
    public static final String ASAAS_CUSTOMER_CREATION_FAILED = "Asaas customer creation failed";
    public static final String ASAAS_CUSTOMER_LOOKUP_FAILED = "Asaas customer lookup failed";
    public static final String ASAAS_PAYMENT_CREATION_FAILED = "Asaas payment creation failed";
    public static final String ASAAS_PAYMENT_LOOKUP_FAILED = "Asaas payment lookup failed";
    public static final String ASAAS_PAYMENT_REFUND_FAILED = "Asaas payment refund failed";
    public static final String ASAAS_PAYMENTS_REQUIRE_BRL = "Asaas payments require BRL";
    public static final String ASAAS_RETURNED_NO_PAYMENT_REFERENCE = "Asaas returned no payment reference";
    public static final String UNSUPPORTED_ASAAS_PAYMENT_STATUS = "Unsupported Asaas payment status";
    public static final String AUTHORIZED_PAYMENT_DOES_NOT_EXIST = "authorized payment does not exist";
    public static final String AUTHORIZED_PAYMENT_DOES_NOT_MATCH_REFUND_REQUEST =
        "authorized payment does not match the refund request";
    public static final String AXON_NOTIFICATION_CLAIMS_ARE_NOT_SUPPORTED =
        "Axon notification claims are not supported";
    public static final String AXON_NOTIFICATION_COMPLETION_IS_NOT_SUPPORTED =
        "Axon notification completion is not supported";
    public static final String CARD_PAYMENTS_CANNOT_HAVE_PIX_STATUS =
        "Card payments cannot have Pix status";
    public static final String CLAIMED_PAYMENT_INBOX_RECORD_IS_INCOMPLETE =
        "claimed payment inbox record is incomplete";
    public static final String CLAIMED_PAYMENT_INBOX_RECORD_IS_MISSING =
        "claimed payment inbox record is missing";
    public static final String CLAIMED_PAYMENT_RESULT_IS_INCOMPLETE =
        "claimed payment result is incomplete";
    public static final String CURRENCY_MUST_BE_ISO_4217 = "currency must be ISO-4217";
    public static final String EFFECT_ID_IDENTIFIES_CONFLICTING_PAYMENT_INTENT =
        "effectId identifies a conflicting payment intent";
    public static final String MERCADO_PAGO_PAYMENT_CREATION_FAILED =
        "Mercado Pago payment creation failed";
    public static final String MERCADO_PAGO_PAYMENT_LOOKUP_FAILED =
        "Mercado Pago payment lookup failed";
    public static final String MERCADO_PAGO_PAYMENT_REFUND_FAILED =
        "Mercado Pago payment refund failed";
    public static final String MERCADO_PAGO_PAYMENTS_REQUIRE_BRL =
        "Mercado Pago payments require BRL";
    public static final String MERCADO_PAGO_RETURNED_NO_PAYMENT_REFERENCE =
        "Mercado Pago returned no payment reference";
    public static final String ONLY_AN_AUTHORIZED_CARD_PAYMENT_CAN_BE_REFUNDED =
        "only an authorized Card payment can be refunded";
    public static final String ONLY_GENERATED_PIX_PAYMENTS_HAVE_A_PIX_CODE =
        "only generated Pix payments have a Pix code";
    public static final String ONLY_GENERATED_PIX_RESULTS_HAVE_A_PIX_CODE =
        "only generated Pix results have a Pix code";
    public static final String OPERATION_KEY_AND_PAYMENT_ID_IDENTIFY_A_DIFFERENT_PAYMENT =
        "operationKey and paymentId identify a different payment";
    public static final String PAYMENT_DATABASE_IS_UNAVAILABLE = "payment database is unavailable";
    public static final String PAYMENT_EFFECT_CLAIM_IS_MISSING = "payment effect claim is missing";
    public static final String PAYMENT_EFFECT_COMPLETED_WITH_ANOTHER_RESULT =
        "payment effect completed with another result";
    public static final String PAYMENT_ID_AND_OPERATION_KEY_IDENTIFY_DIFFERENT_PAYMENTS =
        "paymentId and operationKey identify different payments";
    public static final String PAYMENT_ID_DOES_NOT_MATCH = "paymentId does not match";
    public static final String PAYMENT_IDENTIFIERS_IDENTIFY_A_CONFLICTING_INTENT =
        "payment identifiers identify a conflicting intent";
    public static final String PAYMENT_INBOX_RECORD_WAS_NOT_COMPLETED =
        "payment inbox record was not completed";
    public static final String PAYMENT_OUTBOX_EVENT_WAS_NOT_PERSISTED =
        "payment outbox event was not persisted";
    public static final String PAYMENT_PROJECTION_HAS_NO_REQUESTED_EVENT =
        "Payment projection has no requested event";
    public static final String PAYMENT_PROVIDER_MODE_MUST_BE_MERCADO_PAGO =
        "payment.provider.mode must be mercado-pago";
    public static final String PAYMENT_STATE_CHANGED_WHILE_PROCESSING_PROVIDER_NOTIFICATION =
        "payment state changed while processing provider notification";
    public static final String PAYMENT_STATE_CHANGED_WHILE_PROCESSING_PROVIDER_RESULT =
        "payment state changed while processing provider result";
    public static final String PAYMENT_TRANSACTION_FAILED = "payment transaction failed";
    public static final String PAYMENT_WAS_NOT_PERSISTED = "payment was not persisted";
    public static final String PENDING_PAYMENTS_DO_NOT_EMIT_RESULT_EVENTS =
        "pending payments do not emit result events";
    public static final String PENDING_PAYMENTS_HAVE_NO_EFFECT = "pending payments have no effect";
    public static final String PIX_PAYMENTS_CANNOT_HAVE_CARD_STATUS =
        "Pix payments cannot have Card status";
    public static final String PIX_PAYMENTS_DO_NOT_ACCEPT_CARD_PROVIDER_FIELDS =
        "Pix payments do not accept Card provider fields";
    public static final String PROVIDER_LOOKUP_IS_UNAVAILABLE = "provider lookup is unavailable";
    public static final String PROVIDER_NOTIFICATION_CLAIM_FAILED =
        "provider notification claim failed";
    public static final String PROVIDER_NOTIFICATION_CLAIM_IS_MISSING =
        "provider notification claim is missing";
    public static final String PROVIDER_NOTIFICATION_COMPLETION_FAILED =
        "provider notification completion failed";
    public static final String PROVIDER_NOTIFICATION_DOES_NOT_MATCH_A_STORED_PAYMENT =
        "provider notification does not match a stored payment";
    public static final String PROVIDER_NOTIFICATION_INBOX_RECORD_WAS_NOT_COMPLETED =
        "provider notification inbox record was not completed";
    public static final String PROVIDER_NOTIFICATION_RESOLVED_TO_A_DIFFERENT_PAYMENT =
        "provider notification resolved to a different payment";
    public static final String PROVIDER_NOTIFICATION_TRANSACTION_FAILED =
        "provider notification transaction failed";
    public static final String PROVIDER_PAYMENT_IS_NOT_YET_VISIBLE =
        "provider payment is not yet visible";
    public static final String PROVIDER_RECONCILIATION_IS_UNAVAILABLE =
        "provider reconciliation is unavailable";
    public static final String PROVIDER_REFERENCE_MATCHES_MORE_THAN_ONE_PAYMENT =
        "provider reference matches more than one payment";
    public static final String PROVIDER_REFERENCE_MUST_BE_A_MERCADO_PAGO_PAYMENT_ID =
        "providerReference must be a Mercado Pago payment id";
    public static final String PROVIDER_RESULT_IS_INCOMPATIBLE_WITH_PAYMENT_REQUEST =
        "provider result is incompatible with the payment request";
    public static final String REFUND_IDENTIFIERS_DO_NOT_MATCH_AUTHORIZED_PAYMENT =
        "refund identifiers do not match the authorized payment";
    public static final String REFUND_IDENTIFIERS_DO_NOT_MATCH_PAYMENT =
        "refund identifiers do not match the payment";
    public static final String REFUND_MUST_PRESERVE_APPROVED_PROVIDER_REFERENCE =
        "refund must preserve the approved provider reference";
    public static final String REFUND_REQUIRES_APPROVED_CARD_PAYMENT =
        "refund requires an approved Card payment";
    public static final String REFUND_REQUIRES_APPROVED_PAYMENT =
        "refund requires an approved payment";
    public static final String REFUND_RESULT_DOES_NOT_MATCH_AUTHORIZED_PAYMENT =
        "refund result does not match the authorized payment";
    public static final String STATUS_DOES_NOT_PRODUCE_A_PAYMENT_EFFECT =
        "status does not produce a payment effect";
    public static final String STATUS_DOES_NOT_PRODUCE_A_PAYMENT_EVENT =
        "status does not produce a payment event";
    public static final String TERMINAL_PAYMENT_STATE_CANNOT_CHANGE =
        "terminal payment state cannot change";
    public static final String UNSUPPORTED_MERCADO_PAGO_PAYMENT_STATUS =
        "Unsupported Mercado Pago payment status";
    public static final String UNSUPPORTED_PAYMENT_OUTBOX_EVENT = "unsupported payment outbox event";
    public static final String WORDPRESS_FEDERATION_PAYMENT_UPDATE_FAILED =
        "WordPress federation payment update failed";
    public static final String WORDPRESS_FEDERATION_PAYMENT_UPDATE_INTERRUPTED =
        "WordPress federation payment update interrupted";
    public static final String WORDPRESS_SERVICE_AUTHENTICATION_FAILED =
        "WordPress service authentication failed";
    public static final String WORDPRESS_SERVICE_AUTHENTICATION_INTERRUPTED =
        "WordPress service authentication interrupted";

    private PaymentErrorMessages() {}

    public static String required(String field) {
        return field + " is required";
    }

    public static String unsupportedPaymentEvent(String eventType) {
        return "unsupported payment event: " + eventType;
    }

    public static String paymentDoesNotConsume(String eventType) {
        return "Payment does not consume " + eventType;
    }

    public static String wordpressServiceAuthenticationFailed(int statusCode) {
        return WORDPRESS_SERVICE_AUTHENTICATION_FAILED + ": " + statusCode;
    }

    public static String wordpressFederationPaymentUpdateFailed(int statusCode) {
        return WORDPRESS_FEDERATION_PAYMENT_UPDATE_FAILED + ": " + statusCode;
    }

    public static String mustBe(String property, Object expected) {
        return property + " must be " + expected;
    }

    public static String timeoutMustBeValid(String property) {
        return property + " must be between 1ms and 60s";
    }
}
