package dev.desafio.transaction.transaction.domain;

public final class TransactionErrorMessages {
    public static final String CHECKOUT_BUSY =
        "Checkout creation did not complete before the bounded wait expired";
    public static final String CHECKOUT_IDEMPOTENCY_CONFLICT =
        "The operation key is already bound to a different checkout command";
    public static final String WOO_COMMERCE_AMBIGUOUS_RESULT =
        "WooCommerce checkout result is ambiguous and must be reconciled";
    public static final String TRANSACTION_EVENT_HISTORY_REQUIRED = "transaction event history is required";
    public static final String EVENT_TRANSACTION_MISMATCH = "event belongs to another transaction";
    public static final String EVENT_VERSION_NOT_CONTIGUOUS = "transaction event version is not contiguous";
    public static final String TRANSACTION_FACTS_IMMUTABLE =
        "transaction identity and checkout facts are immutable";
    public static final String ITEMS_REQUIRED = "items are required";
    public static final String AMOUNT_MUST_BE_POSITIVE = "amount must be positive";
    public static final String CURRENCY_MUST_BE_ISO_4217 = "currency must be ISO-4217";
    public static final String PAYMENT_METHOD_INVALID = "paymentMethod must be CARD or PIX";
    public static final String QUANTITY_MUST_BE_POSITIVE = "quantity must be positive";
    public static final String INITIAL_EVENT_OUTCOME_INVALID =
        "only the initial event omits outcome metadata";
    public static final String OUTCOME_METADATA_REQUIRED = "outcome events require outcome metadata";
    public static final String VERSION_MUST_BE_POSITIVE = "version must be positive";
    public static final String TRANSACTION_SELECTOR_INVALID =
        "exactly one transaction selector is required";
    public static final String TRANSACTION_ID_REQUIRED = "transactionId is required";
    public static final String CHECKOUT_COMMAND_HASH_FAILED = "checkout command cannot be hashed";
    public static final String WOO_ORDER_ID_REQUIRED = "Woo order id is required";
    public static final String WOO_ORDER_ITEMS_REQUIRED = "Woo order items are required";
    public static final String PIX_CARD_FIELDS_FORBIDDEN =
        "Pix checkout does not accept Card provider fields";
    public static final String CHECKOUT_CLAIM_TRANSACTION_FAILED = "checkout claim transaction failed";
    public static final String CHECKOUT_DATABASE_UNAVAILABLE = "checkout database is unavailable";
    public static final String CHECKOUT_LEASE_LOST = "checkout lease was lost";
    public static final String WOO_ORDER_CONFIRMATION_NOT_PERSISTED =
        "Woo order confirmation could not be persisted";
    public static final String COMPLETED_CHECKOUT_NOT_READ = "completed checkout could not be read";
    public static final String CHECKOUT_LEASE_NOT_RELEASED = "checkout lease could not be released";
    public static final String CHECKOUT_OPERATION_NOT_PERSISTED = "checkout operation was not persisted";
    public static final String CHECKOUT_OPERATION_NOT_UPDATED = "checkout operation could not be updated";
    public static final String CHECKOUT_ITEMS_NOT_SERIALIZED = "checkout items cannot be serialized";
    public static final String STORED_CHECKOUT_ITEMS_INVALID = "stored checkout items are invalid";
    public static final String WOO_COMMERCE_CHECKOUT_FAILED = "WooCommerce checkout failed";
    public static final String TRANSACTION_ID_CHECKOUT_MISMATCH =
        "transactionId identifies a different checkout";
    public static final String REFERENCE_REQUIRED = "reference is required";
    public static final String WOO_GRAPHQL_LOGIN_FAILED = "WooGraphQL service login failed";
    public static final String WOO_COMMERCE_ORDERS_INVALID = "WooCommerce orders are invalid";
    public static final String WOO_COMMERCE_REFERENCE_NOT_UNIQUE =
        "WooCommerce operation reference is not unique";
    public static final String WOO_COMMERCE_CART_MISSING = "WooCommerce cart is missing";
    public static final String STORED_WOO_ORDER_ID_INVALID = "Stored Woo order id is invalid";
    public static final String WOO_COMMERCE_ITEMS_INVALID = "WooCommerce items are invalid";
    public static final String WOO_COMMERCE_AMOUNT_INVALID = "WooCommerce amount is invalid";
    public static final String WOO_GRAPHQL_ERRORS = "WooGraphQL returned errors";

    private TransactionErrorMessages() {}

    public static String required(String name) {
        return name + " is required";
    }

    public static String outcomeNotReady(Object outcome, Object status) {
        return outcome + " is not ready while Transaction is " + status;
    }

    public static String unsupportedEvent(String eventType) {
        return "Transaction does not consume " + eventType;
    }

    public static String wooGraphQlRequestFailed(int statusCode) {
        return "WooGraphQL request failed: " + statusCode;
    }
}
