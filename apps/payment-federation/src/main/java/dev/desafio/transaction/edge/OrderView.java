package dev.desafio.transaction.edge;

import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.payment.domain.Payment;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.application.checkout.CheckoutResult;
import dev.desafio.transaction.transaction.domain.Transaction;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

public record OrderView(
    String id,
    String wooOrderId,
    String paymentMethod,
    OrderStateView workflow,
    String pixCode
) {
    static OrderView started(CheckoutResult checkout, String paymentMethod) {
        return new OrderView(
            Base64.getEncoder().encodeToString(
                ("order:" + checkout.wooOrderId()).getBytes(StandardCharsets.UTF_8)
            ),
            checkout.wooOrderId(),
            paymentMethod,
            new OrderStateView("CREATED"),
            null
        );
    }

    static OrderView from(
        TransactionView transaction,
        Optional<PaymentView> payment,
        Optional<InventoryReservationView> inventory
    ) {
        return new OrderView(
            Base64.getEncoder().encodeToString(
                ("order:" + transaction.wooOrderId()).getBytes(StandardCharsets.UTF_8)
            ),
            transaction.wooOrderId(),
            transaction.paymentMethod(),
            new OrderStateView(state(transaction, payment.orElse(null), inventory.orElse(null))),
            payment.map(PaymentView::pixCode).orElse(null)
        );
    }

    private static String state(
        TransactionView transaction,
        PaymentView payment,
        InventoryReservationView inventory
    ) {
        if (transaction.status() == Transaction.Status.COMPLETED) return "COMPLETED";
        if (payment != null && payment.status() == Payment.Status.REFUNDED) return "REFUNDED";
        if (inventory != null && inventory.status() == InventoryReservation.Status.REJECTED) {
            return "STOCK_FAILED";
        }
        if (payment != null && payment.status() == Payment.Status.REJECTED) return "CANCELLED";
        if (payment != null && payment.status() == Payment.Status.PIX_GENERATED) return "PIX_GENERATED";
        if (transaction.status() == Transaction.Status.PAYMENT_APPROVED) return "STOCK_PENDING";
        if (payment != null && payment.status() == Payment.Status.AUTHORIZED) return "PAYMENT_AUTHORIZED";
        if (payment != null && payment.method() == Payment.Method.PIX) return "PIX_PENDING";
        if (transaction.status() == Transaction.Status.INVENTORY_RESERVED
            || transaction.status() == Transaction.Status.PAYMENT_PENDING) {
            return "PAYMENT_PENDING";
        }
        return "CREATED";
    }
}
