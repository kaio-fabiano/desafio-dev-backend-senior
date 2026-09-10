package dev.desafio.transaction.inventory.domain;

public final class InventoryErrorMessages {
    public static final String AMOUNT_MUST_BE_POSITIVE = "amount must be positive";
    public static final String AUTHENTICATION_FAILED = "WordPress service authentication failed";
    public static final String AUTHENTICATION_INTERRUPTED = "WordPress service authentication interrupted";
    public static final String CLAIM = "claim";
    public static final String CLAIM_NOT_PERSISTED = "inventory claim was not persisted";
    public static final String CLAIM_OWNERSHIP_LOST = "inventory claim ownership was lost before completion";
    public static final String CLAIM_TRANSACTION_FAILED = "inventory claim transaction failed";
    public static final String CLOCK = "clock";
    public static final String COMPLETED_CLAIM_REQUIRES_EVENT = "a completed inventory claim requires its event";
    public static final String COMPLETION_TRANSACTION_FAILED = "inventory completion transaction failed";
    public static final String CURRENCY_REQUIRED = "currency is required";
    public static final String DATABASE_UNAVAILABLE = "inventory database is unavailable";
    public static final String DATA_SOURCE = "dataSource";
    public static final String EVENT = "event";
    public static final String EVENTS = "events";
    public static final String EVENT_ID = "eventId";
    public static final String INCOMING_EVENT_ID = "incomingEventId";
    public static final String INSUFFICIENT_STOCK = "WooCommerce stock is insufficient";
    public static final String INVENTORY_REQUEST_FAILED = "WordPress federation inventory request failed";
    public static final String INVENTORY_REQUEST_INTERRUPTED = "WooCommerce inventory request interrupted";
    public static final String ITEMS_ARE_REQUIRED = "items are required";
    public static final String ONLY_ACQUIRED_CLAIM_CAN_BE_COMPLETED = "only the acquired inventory claim can be completed";
    public static final String OPERATION_ALREADY_CLAIMED = "Inventory operation is already claimed";
    public static final String OPERATION_KEY = "operationKey";
    public static final String OPERATION_KEY_IDENTIFIES_DIFFERENT_REQUEST = "operationKey identifies a different inventory request";
    public static final String OWNER_TOKEN_REQUIRED = "an acquired inventory claim requires an owner token";
    public static final String PAYMENT_ID_REQUIRED = "paymentId is required";
    public static final String PAYMENT_METHOD_REQUIRED = "paymentMethod is required";
    public static final String PAYMENT_METHOD_ID_REQUIRED = "paymentMethodId is required";
    public static final String PAYMENT_OPERATION_KEY_REQUIRED = "paymentOperationKey is required";
    public static final String PAYER_EMAIL_REQUIRED = "payerEmail is required";
    public static final String PIX_CARD_FIELDS_FORBIDDEN =
        "Pix reservation does not accept Card provider fields";
    public static final String PRODUCT_ID_REQUIRED = "productId is required";
    public static final String PROVIDER_TOKEN_REQUIRED = "providerToken is required";
    public static final String QUANTITY_MUST_BE_POSITIVE = "quantity must be positive";
    public static final String REPOSITORY = "repository";
    public static final String REQUEST = "request";
    public static final String REQUEST_FINGERPRINT = "requestFingerprint";
    public static final String REQUEST_SERIALIZATION_FAILED = "inventory request could not be serialized";
    public static final String RESULT_NOT_PERSISTED = "inventory result was not persisted";
    public static final String STATUS = "status";
    public static final String STOCK = "stock";
    public static final String TRACEPARENT_INVALID = "traceparent is invalid";
    public static final String TRANSACTION_ID_IDENTIFIES_DIFFERENT_RESERVATION = "transactionId identifies a different Inventory reservation";
    public static final String TRANSACTION_ID_REQUIRED = "transactionId is required";
    public static final String UNSUPPORTED_DOMAIN_EVENT = "unsupported Inventory domain event";
    public static final String VIEWS = "views";
    public static final String OCCURRED_AT = "occurredAt";

    private InventoryErrorMessages() {}

    public static String authenticationFailed(int statusCode) {
        return AUTHENTICATION_FAILED + ": " + statusCode;
    }

    public static String inventoryConflict(String orderId) {
        return "WooCommerce order " + orderId + " was processed by another inventory operation";
    }

    public static String inventoryQueryFailed(int statusCode, Object errors) {
        return "WordPress federation inventory query failed: " + statusCode + " " + errors;
    }

    public static String inventoryRequestFailed(int statusCode) {
        return INVENTORY_REQUEST_FAILED + ": " + statusCode;
    }

    public static String orderNotResolved(String orderId) {
        return "WordPress federation did not resolve order " + orderId;
    }

    public static String productNotResolved(String productId) {
        return "WordPress federation did not resolve product " + productId;
    }

    public static String required(String field) {
        return field + " is required";
    }

    public static String unsupportedIntegrationEvent(String eventType) {
        return "unsupported Inventory integration event " + eventType;
    }
}
