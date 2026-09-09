package dev.desafio.transaction.transaction.adapter.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcInboxStore;
import dev.desafio.transaction.transaction.application.command.RecordTransactionOutcome;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.messaging.commandhandling.gateway.CommandGateway;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
@ConditionalOnExpression("'${spring.datasource.url:}'.startsWith('jdbc:postgresql:')")
public final class TransactionRabbitListener {
    private static final String CONSUMER = "transaction";
    private final ReliableAmqpConsumer consumer;
    private final CommandGateway commands;

    public TransactionRabbitListener(
        DataSource dataSource,
        ObjectMapper json,
        RabbitTemplate rabbit,
        CommandGateway commands
    ) {
        this.consumer = new ReliableAmqpConsumer(
            new JdbcInboxStore(dataSource, json, "transaction"),
            new IntegrationEventJson(json),
            new AmqpRetryRouter(rabbit, java.time.Clock.systemUTC())
        );
        this.commands = commands;
    }

    @RabbitListener(queues = "transaction.events.v1")
    public void receive(Message message, Channel channel) throws Exception {
        consumer.receive(CONSUMER, message, channel, this::dispatch);
    }

    private void dispatch(IntegrationEventEnvelope<JsonNode> event) {
        var outcome = switch (event.eventType()) {
            case "inventory.reserved.v1" -> Transaction.Outcome.INVENTORY_RESERVED;
            case "inventory.reservation-rejected.v1" -> Transaction.Outcome.INVENTORY_REJECTED;
            case "payment.pending.v1" -> Transaction.Outcome.PAYMENT_PENDING;
            case "payment.approved.v1" -> Transaction.Outcome.PAYMENT_APPROVED;
            case "payment.rejected.v1" -> Transaction.Outcome.PAYMENT_REJECTED;
            case "inventory.committed.v1" -> Transaction.Outcome.INVENTORY_COMMITTED;
            case "inventory.commit-rejected.v1" -> Transaction.Outcome.INVENTORY_COMMIT_REJECTED;
            case "payment.refunded.v1" -> Transaction.Outcome.PAYMENT_REFUNDED;
            default -> throw new ReliableAmqpConsumer.BusinessRejection(
                "Transaction does not consume " + event.eventType()
            );
        };
        commands.sendAndWait(new RecordTransactionOutcome(
            event.transactionId(), outcome, reference(event.payload(), event.eventId().toString())
        ));
    }

    private String reference(JsonNode payload, String fallback) {
        for (var field : new String[] {"reservationId", "paymentId", "providerReference", "reason"}) {
            var value = payload.path(field).asText();
            if (!value.isBlank()) return value;
        }
        return fallback;
    }
}
