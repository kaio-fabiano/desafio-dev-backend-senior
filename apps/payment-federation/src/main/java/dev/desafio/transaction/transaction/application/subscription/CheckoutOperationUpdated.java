package dev.desafio.transaction.transaction.application.subscription;

import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;

public record CheckoutOperationUpdated(String operationId, String owner) {
    public boolean matches(CheckoutOperationView view) {
        return operationId.equals(view.id()) && owner.equals(view.owner());
    }
}
