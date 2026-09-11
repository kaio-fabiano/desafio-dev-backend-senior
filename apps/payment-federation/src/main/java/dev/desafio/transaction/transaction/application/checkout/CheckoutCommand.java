package dev.desafio.transaction.transaction.application.checkout;

import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;
import org.axonframework.messaging.commandhandling.annotation.Command;

@Command(namespace = "transaction", name = "Checkout", version = "1.0.0", routingKey = "operationId")
public record CheckoutCommand(
    String subject,
    String operationKey,
    String paymentMethod,
    String payerEmail,
    String providerToken,
    String paymentMethodId,
    WooCommerceOrderPort.Session session,
    CheckoutOperationId operationId
) {
    public CheckoutCommand(
        String subject,
        String operationKey,
        String paymentMethod,
        String payerEmail,
        String providerToken,
        String paymentMethodId
    ) {
        this(subject, operationKey, paymentMethod, payerEmail, providerToken, paymentMethodId, null,
            CheckoutOperationId.from(subject, operationKey));
    }

    public CheckoutCommand(
        String subject,
        String operationKey,
        String paymentMethod,
        String payerEmail,
        String providerToken,
        String paymentMethodId,
        WooCommerceOrderPort.Session session
    ) {
        this(subject, operationKey, paymentMethod, payerEmail, providerToken, paymentMethodId, session,
            CheckoutOperationId.from(subject, operationKey));
    }

    public CheckoutCommand {
        subject = required(subject, "subject");
        operationKey = required(operationKey, "operationKey");
        var canonicalOperationId = CheckoutOperationId.from(subject, operationKey);
        if (operationId != null && !operationId.equals(canonicalOperationId)) {
            throw new IllegalArgumentException("operationId does not match checkout identity");
        }
        operationId = canonicalOperationId;
        paymentMethod = required(paymentMethod, "paymentMethod").toUpperCase(java.util.Locale.ROOT);
        payerEmail = required(payerEmail, "payerEmail");
        if (!paymentMethod.equals("CARD") && !paymentMethod.equals("PIX")) {
            throw new IllegalArgumentException(TransactionErrorMessages.PAYMENT_METHOD_INVALID);
        }
        if (paymentMethod.equals("CARD")) {
            providerToken = required(providerToken, "providerToken");
            paymentMethodId = required(paymentMethodId, "paymentMethodId");
        } else if (hasText(providerToken) || hasText(paymentMethodId)) {
            throw new IllegalArgumentException(TransactionErrorMessages.PIX_CARD_FIELDS_FORBIDDEN);
        }
    }

    private static String required(String value, String name) {
        if (!hasText(value)) throw new IllegalArgumentException(TransactionErrorMessages.required(name));
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
