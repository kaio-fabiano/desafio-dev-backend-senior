package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.Payment;

@FunctionalInterface
public interface PaymentProvider {
    Result execute(Payment.Command command);

    default Result findByProviderReference(String providerReference) {
        throw new UnsupportedOperationException("provider lookup is unavailable");
    }

    default Result reconcile(Payment.Command command) {
        if (command instanceof Payment.RefundRequested refund && refund.providerReference() != null) {
            return findByProviderReference(refund.providerReference());
        }
        throw new UnsupportedOperationException("provider reconciliation is unavailable");
    }

    record Result(String providerReference, Payment.Status status, String pixCode) {
        public Result {
            new Payment.ProviderResult(providerReference, status, pixCode);
        }

        public Payment.ProviderResult toDomainResult() {
            return new Payment.ProviderResult(providerReference, status, pixCode);
        }
    }

}
