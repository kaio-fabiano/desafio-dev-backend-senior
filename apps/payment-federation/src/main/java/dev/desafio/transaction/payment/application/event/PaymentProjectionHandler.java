package dev.desafio.transaction.payment.application.event;

import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.domain.event.PaymentApproved;
import dev.desafio.transaction.payment.domain.event.PaymentPending;
import dev.desafio.transaction.payment.domain.event.PaymentRefunded;
import dev.desafio.transaction.payment.domain.event.PaymentRejected;
import dev.desafio.transaction.payment.domain.event.PaymentRequested;
import org.axonframework.messaging.eventhandling.annotation.EventHandler;

public final class PaymentProjectionHandler {
    private final PaymentProjection projection;

    public PaymentProjectionHandler(PaymentProjection projection) {
        this.projection = java.util.Objects.requireNonNull(projection, "projection");
    }

    @EventHandler
    public void on(PaymentRequested event) {
        projection.project(event);
    }

    @EventHandler
    public void on(PaymentPending event) {
        projection.project(event);
    }

    @EventHandler
    public void on(PaymentApproved event) {
        projection.project(event);
    }

    @EventHandler
    public void on(PaymentRejected event) {
        projection.project(event);
    }

    @EventHandler
    public void on(PaymentRefunded event) {
        projection.project(event);
    }
}
