package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.application.PaymentHandler;
import dev.desafio.transaction.payment.application.query.PaymentView;

import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.UUID;

public final class AuthorizePaymentHandler {
    private final PaymentHandler paymentHandler;

    public AuthorizePaymentHandler(PaymentHandler paymentHandler) {
        this.paymentHandler = Objects.requireNonNull(paymentHandler, "paymentHandler");
    }

    public AuthorizePaymentHandler(PaymentHandler paymentHandler, OrderPaymentPort orders) {
        this(paymentHandler);
        Objects.requireNonNull(orders, "orders");
    }

    public PaymentView handle(AuthorizePayment command) {
        Objects.requireNonNull(command, "command");
        var domainCommand = command.toDomainCommand();
        var result = paymentHandler.handle(deliveryId(domainCommand), domainCommand);
        return PaymentView.from(result.payment());
    }

    private UUID deliveryId(dev.desafio.transaction.payment.domain.Payment.PaymentRequested command) {
        var material = String.join(
            "\u0000",
            command.operationKey(),
            command.paymentId(),
            command.orderId(),
            command.method().name(),
            command.amount().toPlainString(),
            command.currency().toUpperCase(java.util.Locale.ROOT)
        );
        return UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8));
    }
}
