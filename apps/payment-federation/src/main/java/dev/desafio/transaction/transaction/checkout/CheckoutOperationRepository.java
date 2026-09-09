package dev.desafio.transaction.transaction.checkout;

import dev.desafio.transaction.transaction.domain.Transaction;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

public interface CheckoutOperationRepository {
    Claim claim(ClaimRequest request, Instant now, Duration lease);
    void beginWooCreation(String transactionId, String ownerToken, Instant now);
    Operation recordWooOrder(
        String transactionId,
        String ownerToken,
        WooCommerceOrderPort.Order order,
        Instant now
    );
    Operation complete(String transactionId, String ownerToken, Instant now);
    void release(String transactionId, String ownerToken, Instant now);

    record ClaimRequest(String subject, String operationKey, String commandHash, String wooReference) {}
    record Claim(Operation operation, String ownerToken) {}

    record Operation(
        String transactionId,
        String operationKey,
        String subject,
        String commandHash,
        String wooReference,
        String wooOrderId,
        List<Transaction.Item> items,
        BigDecimal amount,
        String currency,
        Status status
    ) {
        public Operation(
            String transactionId,
            String operationKey,
            String subject,
            String commandHash,
            String wooReference,
            String wooOrderId,
            Status status
        ) {
            this(
                transactionId, operationKey, subject, commandHash, wooReference, wooOrderId,
                List.of(), null, null, status
            );
        }

        public Operation withStatus(Status value) {
            return new Operation(
                transactionId, operationKey, subject, commandHash, wooReference, wooOrderId,
                items, amount, currency, value
            );
        }

        public Operation withWooOrder(WooCommerceOrderPort.Order order) {
            return new Operation(
                transactionId, operationKey, subject, commandHash, wooReference, order.id(),
                order.items(), order.amount(), order.currency(), status
            );
        }
    }

    enum Status { PENDING_WOO, CREATING_WOO, WOO_CONFIRMED, COMPLETED }
}
