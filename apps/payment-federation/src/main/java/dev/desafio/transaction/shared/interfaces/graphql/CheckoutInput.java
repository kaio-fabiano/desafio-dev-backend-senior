package dev.desafio.transaction.shared.interfaces.graphql;

import dev.desafio.transaction.transaction.checkout.CheckoutCommand;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;

import java.util.Locale;

public record CheckoutInput(
    String operationKey,
    String paymentMethod,
    String payerEmail,
    String providerToken,
    String paymentMethodId
) {
    public CheckoutInput {
        operationKey = required(operationKey, "operationKey");
        paymentMethod = required(paymentMethod, "paymentMethod").toUpperCase(Locale.ROOT);
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

    CheckoutCommand command(String owner, WooCommerceOrderPort.Session session) {
        return new CheckoutCommand(
            owner, operationKey, paymentMethod, payerEmail, providerToken, paymentMethodId, session
        );
    }

    private static String required(String value, String name) {
        if (!hasText(value)) throw new IllegalArgumentException(name + " is required");
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
