package dev.desafio.transaction.shared.infrastructure.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.rabbitmq.client.Channel;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.shared.infrastructure.persistence.JdbcInboxStore;
import org.springframework.amqp.core.Message;

public final class ReliableAmqpConsumer {
    private final JdbcInboxStore inbox;
    private final IntegrationEventJson json;
    private final AmqpRetryRouter retryRouter;

    public ReliableAmqpConsumer(
        JdbcInboxStore inbox,
        IntegrationEventJson json,
        AmqpRetryRouter retryRouter
    ) {
        this.inbox = inbox;
        this.json = json;
        this.retryRouter = retryRouter;
    }

    public void receive(
        String consumer,
        Message message,
        Channel channel,
        EventDispatcher dispatcher
    ) throws Exception {
        var deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            var event = json.read(message.getBody());
            inbox.processOnce(consumer, event, received -> {
                try {
                    dispatcher.dispatch(received);
                    return JdbcInboxStore.Disposition.COMPLETED;
                } catch (BusinessRejection rejection) {
                    return JdbcInboxStore.Disposition.BUSINESS_REJECTED;
                }
            });
            channel.basicAck(deliveryTag, false);
        } catch (Exception failure) {
            try {
                retryRouter.routeTechnicalFailure(consumer, message, failure);
                channel.basicAck(deliveryTag, false);
            } catch (Exception routingFailure) {
                routingFailure.addSuppressed(failure);
                channel.basicNack(deliveryTag, false, true);
                throw routingFailure;
            }
        }
    }

    @FunctionalInterface
    public interface EventDispatcher {
        void dispatch(IntegrationEventEnvelope<JsonNode> event);
    }

    public static final class BusinessRejection extends RuntimeException {
        public BusinessRejection(String message) {
            super(message);
        }
    }
}
