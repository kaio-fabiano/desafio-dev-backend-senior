package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;

public interface CheckoutOperationUpdatePublisher {
    void publish(CheckoutOperationView view);
}
