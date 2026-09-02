package dev.desafio.transaction.payment.application.command;

import dev.desafio.transaction.payment.application.query.PaymentView;

public interface OrderPaymentPort {
    void record(AuthorizePayment command, PaymentView payment);
}
