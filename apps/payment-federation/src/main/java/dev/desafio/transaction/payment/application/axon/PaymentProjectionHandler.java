package dev.desafio.transaction.payment.application.axon;

import dev.desafio.transaction.payment.application.PaymentProjection;
import dev.desafio.transaction.payment.application.event.PaymentApproved;
import dev.desafio.transaction.payment.application.event.PaymentPending;
import dev.desafio.transaction.payment.application.event.PaymentRefunded;
import dev.desafio.transaction.payment.application.event.PaymentRejected;
import dev.desafio.transaction.payment.application.event.PaymentRequested;
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
