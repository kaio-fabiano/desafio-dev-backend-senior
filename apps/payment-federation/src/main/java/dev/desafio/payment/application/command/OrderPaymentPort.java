package dev.desafio.payment.application.command;

import dev.desafio.payment.application.query.PaymentView;

public interface OrderPaymentPort {
    void record(AuthorizePayment command, PaymentView payment);
}
