package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.application.event.PaymentApproved;
import dev.desafio.transaction.payment.application.event.PaymentPending;
import dev.desafio.transaction.payment.application.event.PaymentRefunded;
import dev.desafio.transaction.payment.application.event.PaymentRejected;
import dev.desafio.transaction.payment.application.event.PaymentRequested;

public interface PaymentProjection {
    void project(PaymentRequested event);

    void project(PaymentPending event);

    void project(PaymentApproved event);

    void project(PaymentRejected event);

    void project(PaymentRefunded event);
}
