package dev.desafio.transaction.payment.application;

import dev.desafio.transaction.payment.domain.PaymentErrorMessages;
import dev.desafio.transaction.payment.domain.Payment;

@FunctionalInterface
public interface PaymentProvider {
    Result execute(Payment.ProviderRequest command);

    default Result findByProviderReference(String providerReference) {
        throw new UnsupportedOperationException(PaymentErrorMessages.PROVIDER_LOOKUP_IS_UNAVAILABLE);
    }

    default Result reconcile(Payment.ProviderRequest command) {
        if (command instanceof Payment.RefundRequested refund && refund.providerReference() != null) {
            return findByProviderReference(refund.providerReference());
        }
        throw new UnsupportedOperationException(PaymentErrorMessages.PROVIDER_RECONCILIATION_IS_UNAVAILABLE);
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
