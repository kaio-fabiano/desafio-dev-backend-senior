package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.event.PaymentApproved;
import dev.desafio.transaction.payment.domain.event.PaymentPending;
import dev.desafio.transaction.payment.domain.event.PaymentRefunded;
import dev.desafio.transaction.payment.domain.event.PaymentRejected;
import dev.desafio.transaction.payment.domain.event.PaymentRequested;

public interface PaymentProjection {
    void project(PaymentRequested event);

    void project(PaymentPending event);

    void project(PaymentApproved event);

    void project(PaymentRejected event);

    void project(PaymentRefunded event);
}
