package dev.desafio.transaction.edge;

import dev.desafio.transaction.transaction.application.command.CheckoutCommand;
import dev.desafio.transaction.transaction.application.checkout.WooCommerceOrderPort;

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
            throw new IllegalArgumentException(GraphQlErrorMessages.PAYMENT_METHOD);
        }
        if (paymentMethod.equals("CARD")) {
            providerToken = required(providerToken, "providerToken");
            paymentMethodId = required(paymentMethodId, "paymentMethodId");
        } else if (hasText(providerToken) || hasText(paymentMethodId)) {
            throw new IllegalArgumentException(GraphQlErrorMessages.PIX_CARD_FIELDS);
        }
    }

    CheckoutCommand command(String owner, WooCommerceOrderPort.Session session) {
        return new CheckoutCommand(
            owner, operationKey, paymentMethod, payerEmail, providerToken, paymentMethodId, session
        );
    }

    private static String required(String value, String name) {
        if (!hasText(value)) {
            throw new IllegalArgumentException(GraphQlErrorMessages.required(name));
        }
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
