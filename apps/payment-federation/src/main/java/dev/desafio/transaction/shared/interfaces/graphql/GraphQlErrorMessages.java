package dev.desafio.transaction.shared.interfaces.graphql;

final class GraphQlErrorMessages {
    static final String PAYMENT_METHOD = "paymentMethod must be CARD or PIX";
    static final String PIX_CARD_FIELDS = "Pix checkout does not accept Card provider fields";
    static final String WOO_ORDER_ID = "Order id must be a WooCommerce global id";
    static final String CHECKOUT_WRITES_UNAVAILABLE = "Checkout writes are unavailable";

    private GraphQlErrorMessages() {}

    static String required(String name) {
        return name + " is required";
    }
}
