package dev.desafio.transaction.transaction.application.checkout;

import dev.desafio.transaction.transaction.domain.Transaction;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CheckoutOperationRepository {
    Operation createOrLoad(CreateRequest request, Instant now);
    boolean markWooCreationRequested(String operationId, Instant now);
    Operation recordWooOrder(String operationId, WooCommerceOrderPort.Order order, Instant now);
    Operation complete(String operationId, Instant now);
    Operation fail(String operationId, String reason, Instant now);
    Optional<Operation> find(String operationId, String subject);

    record CreateRequest(String operationId, String subject, String operationKey, String commandHash,
                         String wooReference) {
        public CreateRequest {
            require(operationId, "operationId");
            require(subject, "subject");
            require(operationKey, "operationKey");
            if (!operationId.equals(CheckoutOperationId.from(subject, operationKey).value())) {
                throw new IllegalArgumentException("operationId does not match checkout identity");
            }
            require(commandHash, "commandHash");
            if (!commandHash.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("commandHash must be a SHA-256 hex value");
            require(wooReference, "wooReference");
        }

        private static void require(String value, String name) {
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException(name + " is required");
            }
        }
    }

    record Operation(String operationId, String operationKey, String subject, String commandHash, String wooReference,
                     String wooOrderId, List<Transaction.Item> items, BigDecimal amount, String currency,
                     String paymentId, String errorReason, Status status) {
        public Operation(String operationId, String operationKey, String subject, String commandHash, String wooReference, String wooOrderId, Status status) {
            this(operationId, operationKey, subject, commandHash, wooReference, wooOrderId, List.of(), null, null, "payment:" + operationId, null, status);
        }
        public Operation withStatus(Status value) {
            return new Operation(operationId, operationKey, subject, commandHash, wooReference, wooOrderId, items, amount, currency, paymentId, errorReason, value);
        }
        public Operation withWooOrder(WooCommerceOrderPort.Order order) {
            return new Operation(operationId, operationKey, subject, commandHash, wooReference, order.id(), order.items(), order.amount(), order.currency(), paymentId, errorReason, status);
        }
        public Operation withError(String reason) {
            return new Operation(operationId, operationKey, subject, commandHash, wooReference, wooOrderId, items, amount, currency, paymentId, reason, Status.FAILED);
        }
    }
    enum Status { PENDING_WOO, WOO_CREATION_REQUESTED, WOO_CONFIRMED, COMPLETED, FAILED }
}
