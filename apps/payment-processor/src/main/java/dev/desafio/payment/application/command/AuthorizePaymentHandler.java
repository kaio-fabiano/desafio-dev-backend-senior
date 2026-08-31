package dev.desafio.payment.application.command;

import dev.desafio.payment.application.PaymentHandler;
import dev.desafio.payment.application.query.PaymentView;

import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.UUID;

public final class AuthorizePaymentHandler {
    private final PaymentHandler paymentHandler;
    private final OrderPaymentPort orders;

    public AuthorizePaymentHandler(PaymentHandler paymentHandler) {
        this(paymentHandler, (command, payment) -> {});
    }

    public AuthorizePaymentHandler(PaymentHandler paymentHandler, OrderPaymentPort orders) {
        this.paymentHandler = Objects.requireNonNull(paymentHandler, "paymentHandler");
        this.orders = Objects.requireNonNull(orders, "orders");
    }

    public PaymentView handle(AuthorizePayment command) {
        Objects.requireNonNull(command, "command");
        var domainCommand = command.toDomainCommand();
        var result = paymentHandler.handle(deliveryId(domainCommand), domainCommand);
        var payment = PaymentView.from(result.payment());
        orders.record(command, payment);
        return payment;
    }

    private UUID deliveryId(dev.desafio.payment.domain.Payment.PaymentRequested command) {
        var material = String.join("\u0000",
            command.operationKey(), command.paymentId(), command.orderId(), command.method().name(),
            command.amount().toPlainString(), command.currency().toUpperCase(java.util.Locale.ROOT)
        );
        return UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8));
    }
}
