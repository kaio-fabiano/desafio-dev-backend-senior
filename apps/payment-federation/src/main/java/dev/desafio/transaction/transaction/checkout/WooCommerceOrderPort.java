package dev.desafio.transaction.transaction.checkout;

import dev.desafio.transaction.transaction.domain.Transaction;

import java.math.BigDecimal;
import java.util.List;

public interface WooCommerceOrderPort {
    Order createOrFind(Request request) throws Exception;

    default Order findByReference(Request request) throws Exception {
        return null;
    }

    record Request(String subject, String reference, String paymentMethod, Session session) {
        public Request(String subject, String reference, String paymentMethod) {
            this(subject, reference, paymentMethod, null);
        }
    }

    record Session(String cartToken, String wooSession, String cookie) {}

    record Order(
        String id,
        List<Transaction.Item> items,
        BigDecimal amount,
        String currency
    ) {
        public Order {
            if (id == null || id.isBlank()) throw new IllegalArgumentException("Woo order id is required");
            items = List.copyOf(items);
            if (items.isEmpty()) throw new IllegalArgumentException("Woo order items are required");
            if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("amount must be positive");
            if (currency == null || !currency.matches("[A-Z]{3}")) {
                throw new IllegalArgumentException("currency must be ISO-4217");
            }
        }
    }

    final class AmbiguousResponseException extends RuntimeException {
        public AmbiguousResponseException() {
            super("WooCommerce checkout result is ambiguous and must be reconciled");
        }
    }
}
