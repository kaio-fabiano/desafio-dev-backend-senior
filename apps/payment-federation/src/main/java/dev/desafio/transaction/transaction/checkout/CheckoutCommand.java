package dev.desafio.transaction.transaction.checkout;

public record CheckoutCommand(
    String subject,
    String operationKey,
    String paymentMethod,
    String payerEmail,
    String providerToken,
    String paymentMethodId,
    WooCommerceOrderPort.Session session
) {
    public CheckoutCommand(
        String subject,
        String operationKey,
        String paymentMethod,
        String payerEmail,
        String providerToken,
        String paymentMethodId
    ) {
        this(subject, operationKey, paymentMethod, payerEmail, providerToken, paymentMethodId, null);
    }

    public CheckoutCommand {
        subject = required(subject, "subject");
        operationKey = required(operationKey, "operationKey");
        paymentMethod = required(paymentMethod, "paymentMethod").toUpperCase(java.util.Locale.ROOT);
        payerEmail = required(payerEmail, "payerEmail");
        if (!paymentMethod.equals("CARD") && !paymentMethod.equals("PIX")) {
            throw new IllegalArgumentException("paymentMethod must be CARD or PIX");
        }
        if (paymentMethod.equals("CARD")) {
            providerToken = required(providerToken, "providerToken");
            paymentMethodId = required(paymentMethodId, "paymentMethodId");
        } else if (hasText(providerToken) || hasText(paymentMethodId)) {
            throw new IllegalArgumentException("Pix checkout does not accept Card provider fields");
        }
    }

    private static String required(String value, String name) {
        if (!hasText(value)) throw new IllegalArgumentException(name + " is required");
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
