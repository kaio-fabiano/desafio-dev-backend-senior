package dev.desafio.transaction.infrastructure.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.GetResponse;
import dev.desafio.transaction.configuration.AmqpTopologyConfiguration;
import dev.desafio.transaction.configuration.MarketplaceAmqp;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import dev.desafio.transaction.shared.infrastructure.messaging.AmqpRetryRouter;
import dev.desafio.transaction.shared.infrastructure.messaging.ConfirmedAmqpPublisher;
import dev.desafio.transaction.shared.infrastructure.messaging.IntegrationEventJson;
import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelay;
import dev.desafio.transaction.shared.infrastructure.messaging.ReliableAmqpConsumer;
import dev.desafio.transaction.shared.infrastructure.persistence.InboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.InventoryAmqpInboxJpaRepository;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaInboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.JpaOutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.OutboxStore;
import dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpInboxEntity;
import dev.desafio.transaction.shared.infrastructure.persistence.TransactionAmqpOutboxJpaRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Exchange;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.support.DefaultMessagePropertiesConverter;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.transaction.TransactionAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RabbitMqBoundaryIntegrationTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");
    private static final GenericContainer<?> RABBIT =
        new GenericContainer<>("rabbitmq:4.1.3-management-alpine").withExposedPorts(5672);
    private static final Clock CLOCK = Clock.fixed(
        Instant.parse("2026-09-09T12:00:00Z"), ZoneOffset.UTC
    );

    private static DataSource dataSource;
    private static ConfigurableApplicationContext persistence;
    private static CachingConnectionFactory connectionFactory;
    private static RabbitTemplate rabbit;
    private static ObjectMapper objectMapper;

    @BeforeAll
    static void startInfrastructure() {
        POSTGRES.start();
        RABBIT.start();

        persistence = persistenceContext();
        dataSource = persistence.getBean(DataSource.class);

        connectionFactory = connectionFactory(RABBIT.getMappedPort(5672));
        rabbit = new RabbitTemplate(connectionFactory);
        rabbit.setMandatory(true);
        declareTopology(connectionFactory);
        objectMapper = new ObjectMapper().findAndRegisterModules();
    }

    @AfterAll
    static void stopInfrastructure() {
        if (connectionFactory != null) connectionFactory.destroy();
        if (persistence != null) persistence.close();
        RABBIT.stop();
        POSTGRES.stop();
    }

    @Test
    @DisplayName("Atomic outbox publication is recoverable, at-least-once, and harmless on redelivery @spec:AC-345 @spec:AC-346 @spec:AC-347 @spec:AC-350")
    void outboxRecoveryDuplicateDeliveryRetryAndDlqPreserveTheV1Envelope() throws Exception {
        var codec = new IntegrationEventJson(objectMapper);
        var outbox = transactionOutbox();
        var inbox = inventoryInbox();
        var event = event("event-245");
        IntegrationEventEnvelope<com.fasterxml.jackson.databind.JsonNode> credentialEvent =
            new IntegrationEventEnvelope<>(
            event.eventId(), event.eventType(), event.version(), event.aggregateId(),
            event.transactionId(), event.correlationId(), event.causationId(), event.occurredAt(),
            objectMapper.valueToTree(Map.of("providerToken", "must-not-leave-payment"))
            );
        assertThrows(IllegalArgumentException.class, () -> codec.write(credentialEvent));
        outbox.enqueue("source-event-245", event);
        assertThrows(IllegalArgumentException.class, () ->
            outbox.enqueue("source-event-245", event("different-event-245"))
        );

        var unavailableConnection = connectionFactory(unusedPort());
        try {
            var unavailableRelay = new OutboxRelay(
                outbox,
                new ConfirmedAmqpPublisher(new RabbitTemplate(unavailableConnection), codec),
                codec,
                CLOCK,
                "relay-245"
            );
            assertThrows(RuntimeException.class, () -> unavailableRelay.publishAvailable(10));
            assertEquals(1, outbox.pendingCount());
        } finally {
            unavailableConnection.destroy();
        }

        var publisher = new ConfirmedAmqpPublisher(rabbit, codec);
        var relay = new OutboxRelay(outbox, publisher, codec, CLOCK, "relay-245");
        assertEquals(1, relay.publishAvailable(10));
        assertEquals(0, outbox.pendingCount());

        var retryRouter = new AmqpRetryRouter(rabbit, CLOCK);
        var consumer = new ReliableAmqpConsumer(inbox, codec, retryRouter);
        var deliveries = new AtomicInteger();
        try (var channel = connectionFactory.createConnection().createChannel(false)) {
            var first = receive(channel, MarketplaceAmqp.eventQueue("inventory"));
            consumer.receive("inventory", first, channel, ignored -> {
                assertFalse(TransactionSynchronizationManager.hasResource(dataSource));
                new TransactionTemplate(new DataSourceTransactionManager(dataSource)).execute(
                    status -> new JdbcTemplate(dataSource).queryForObject("select 1", Integer.class)
                );
                deliveries.incrementAndGet();
            });
            assertEquals("COMPLETED", inbox.disposition("inventory", event.eventId()));
            assertEquals(1, deliveries.get());

            publisher.publish(event);
            var duplicate = receive(channel, MarketplaceAmqp.eventQueue("inventory"));
            consumer.receive("inventory", duplicate, channel, ignored -> deliveries.incrementAndGet());
            assertEquals(1, deliveries.get());

            var retryEvent = event("retry-event-245");
            publisher.publish(retryEvent);
            var failed = receive(channel, MarketplaceAmqp.eventQueue("inventory"));
            var originalBody = failed.getBody().clone();
            consumer.receive("inventory", failed, channel, ignored -> {
                throw new IllegalStateException("temporary failure");
            });

            var retried = receive(channel, MarketplaceAmqp.eventQueue("inventory"));
            assertArrayEquals(originalBody, retried.getBody());
            assertEquals(1, ((Number) retried.getMessageProperties()
                .getHeader("x-retry-attempt")).intValue());
            consumer.receive("inventory", retried, channel, ignored -> deliveries.incrementAndGet());
            assertEquals("COMPLETED", inbox.disposition("inventory", retryEvent.eventId()));

            var rejectedEvent = event("business-rejection-245");
            publisher.publish(rejectedEvent);
            var rejected = receive(channel, MarketplaceAmqp.eventQueue("inventory"));
            consumer.receive("inventory", rejected, channel, ignored -> {
                throw new ReliableAmqpConsumer.BusinessRejection("not retryable");
            });
            assertEquals(
                "BUSINESS_REJECTED",
                inbox.disposition("inventory", rejectedEvent.eventId())
            );

            var poisonBody = "{\"eventId\":\"not-an-envelope\"}"
                .getBytes(StandardCharsets.UTF_8);
            publishPoison(channel, poisonBody);
            var poison = receive(channel, MarketplaceAmqp.eventQueue("inventory"));
            consumer.receive("inventory", poison, channel, ignored -> deliveries.incrementAndGet());
            var deadLetter = receive(channel, MarketplaceAmqp.deadLetterQueue("inventory"));
            assertArrayEquals(poisonBody, deadLetter.getBody());
            assertEquals("inventory", deadLetter.getMessageProperties().getHeader("x-consumer"));
            assertEquals(4, ((Number) deadLetter.getMessageProperties()
                .getHeader("x-retry-attempt")).intValue());
            assertNotNull(deadLetter.getMessageProperties().getHeader("x-failure-class"));
            assertNotNull(deadLetter.getMessageProperties().getHeader("x-failure-message"));
            assertNotNull(deadLetter.getMessageProperties().getHeader("x-failed-at"));
            assertEquals("command-245", deadLetter.getMessageProperties().getHeader("causationId"));
            assertEquals(
                "transaction-245",
                deadLetter.getMessageProperties().getHeader("transactionId")
            );

            assertThrows(RuntimeException.class, () -> publisher.publish(event, "unrouted.event.v1"));
        }

        assertEquals(2, deliveries.get());
        var jdbc = new JdbcTemplate(dataSource);
        assertEquals(2, jdbc.queryForObject(
            "select count(*) from inventory.amqp_inbox where disposition = 'COMPLETED'",
            Integer.class
        ));
        assertTrue(Arrays.equals(codec.write(event), codec.write(codec.read(codec.write(event)))));
    }

    private static IntegrationEventEnvelope<com.fasterxml.jackson.databind.JsonNode> event(
        String source
    ) {
        return new IntegrationEventEnvelope<>(
            UUID.nameUUIDFromBytes(source.getBytes(StandardCharsets.UTF_8)),
            "transaction.order-received.v1",
            1,
            "transaction-245",
            "transaction-245",
            "correlation-245",
            "command-245",
            CLOCK.instant(),
            objectMapper.valueToTree(Map.of("orderId", "order-245"))
        );
    }

    private static void declareTopology(CachingConnectionFactory factory) {
        var admin = new RabbitAdmin(factory);
        var topology = new AmqpTopologyConfiguration().marketplaceAmqpTopology();
        topology.getDeclarablesByType(Exchange.class).forEach(admin::declareExchange);
        topology.getDeclarablesByType(Queue.class).forEach(admin::declareQueue);
        topology.getDeclarablesByType(Binding.class).forEach(admin::declareBinding);
    }

    private static CachingConnectionFactory connectionFactory(int port) {
        var factory = new CachingConnectionFactory(RABBIT.getHost(), port);
        factory.setUsername("guest");
        factory.setPassword("guest");
        factory.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.SIMPLE);
        factory.setPublisherReturns(true);
        factory.getRabbitConnectionFactory().setConnectionTimeout(300);
        return factory;
    }

    private static int unusedPort() {
        try (var socket = new java.net.ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (java.io.IOException error) {
            throw new IllegalStateException(error);
        }
    }

    private static Message receive(Channel channel, String queue) {
        var response = new AtomicReference<GetResponse>();
        await().atMost(Duration.ofSeconds(8)).until(() -> {
            var delivery = channel.basicGet(queue, false);
            if (delivery == null) return false;
            response.set(delivery);
            return true;
        });
        var delivery = response.get();
        var properties = new DefaultMessagePropertiesConverter().toMessageProperties(
            delivery.getProps(),
            delivery.getEnvelope(),
            StandardCharsets.UTF_8.name()
        );
        properties.setDeliveryTag(delivery.getEnvelope().getDeliveryTag());
        return new Message(delivery.getBody(), properties);
    }

    private static void publishPoison(Channel channel, byte[] body) throws java.io.IOException {
        var properties = new com.rabbitmq.client.AMQP.BasicProperties.Builder()
            .contentType(MessageProperties.CONTENT_TYPE_JSON)
            .deliveryMode(2)
            .messageId("poison-245")
            .type("transaction.order-received.v1")
            .correlationId("correlation-245")
            .headers(Map.of(
                "causationId", "command-245",
                "transactionId", "transaction-245",
                "x-retry-attempt", 3
            ))
            .build();
        channel.basicPublish(
            MarketplaceAmqp.EVENTS_EXCHANGE,
            "transaction.order-received.v1",
            true,
            properties,
            body
        );
    }

    private static OutboxStore transactionOutbox() {
        return JpaOutboxStore.transaction(
            persistence.getBean(TransactionAmqpOutboxJpaRepository.class),
            persistence.getBean(EntityManager.class), objectMapper,
            persistence.getBean(PlatformTransactionManager.class)
        );
    }

    private static InboxStore inventoryInbox() {
        return JpaInboxStore.inventory(
            persistence.getBean(InventoryAmqpInboxJpaRepository.class),
            persistence.getBean(EntityManager.class), objectMapper, CLOCK,
            persistence.getBean(PlatformTransactionManager.class)
        );
    }

    private static ConfigurableApplicationContext persistenceContext() {
        return new SpringApplicationBuilder(AmqpPersistenceTestApplication.class)
            .web(WebApplicationType.NONE)
            .properties(
                "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "spring.datasource.username=" + POSTGRES.getUsername(),
                "spring.datasource.password=" + POSTGRES.getPassword(),
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.jpa.open-in-view=false",
                "spring.flyway.enabled=true",
                "spring.flyway.create-schemas=true",
                "spring.flyway.default-schema=axon",
                "spring.flyway.schemas=axon,transaction,inventory,payment"
            )
            .run();
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({
        DataSourceAutoConfiguration.class,
        FlywayAutoConfiguration.class,
        HibernateJpaAutoConfiguration.class,
        TransactionAutoConfiguration.class,
        JacksonAutoConfiguration.class
    })
    @EntityScan(basePackageClasses = TransactionAmqpInboxEntity.class)
    @EnableJpaRepositories(basePackageClasses = TransactionAmqpOutboxJpaRepository.class)
    static class AmqpPersistenceTestApplication {}
}
