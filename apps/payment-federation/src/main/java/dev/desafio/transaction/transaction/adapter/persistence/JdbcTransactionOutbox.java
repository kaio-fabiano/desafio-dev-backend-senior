package dev.desafio.transaction.transaction.adapter.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcOutboxStore;
import dev.desafio.transaction.transaction.application.TransactionOutbox;
import dev.desafio.transaction.transaction.application.event.TransactionEvent;

import javax.sql.DataSource;

public final class JdbcTransactionOutbox implements TransactionOutbox {
    private final ObjectMapper json;
    private final JdbcOutboxStore outbox;

    public JdbcTransactionOutbox(DataSource dataSource, ObjectMapper json) {
        this.json = json;
        outbox = new JdbcOutboxStore(dataSource, json, "transaction");
    }

    @Override
    public void enqueueOrderReceived(TransactionEvent event) {
        var payload = json.createObjectNode();
        payload.put("orderId", event.wooOrderId());
        payload.put("paymentMethod", event.paymentMethod());
        payload.put("amount", event.amount());
        payload.put("currency", event.currency());
        payload.put("paymentId", "payment:" + event.transactionId());
        payload.put("paymentOperationKey", event.operationKey() + ":payment");
        payload.put("payerEmail", event.owner());
        payload.set("items", json.valueToTree(event.items()));
        outbox.enqueue(event.eventId().toString(), new IntegrationEventEnvelope<>(
            event.eventId(),
            "transaction.order-received.v1",
            1,
            event.transactionId(),
            event.transactionId(),
            event.operationKey(),
            event.eventId().toString(),
            event.occurredAt(),
            payload
        ));
    }
}
