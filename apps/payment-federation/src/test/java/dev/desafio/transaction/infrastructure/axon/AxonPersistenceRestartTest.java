package dev.desafio.transaction.infrastructure.axon;

import dev.desafio.transaction.PaymentFederationApplication;
import org.axonframework.eventsourcing.eventstore.AppendCondition;
import org.axonframework.eventsourcing.eventstore.EventStorageEngine;
import org.axonframework.eventsourcing.eventstore.GenericTaggedEventMessage;
import org.axonframework.eventsourcing.eventstore.SourcingCondition;
import org.axonframework.messaging.core.MessageType;
import org.axonframework.messaging.eventhandling.GenericEventMessage;
import org.axonframework.messaging.eventhandling.processing.streaming.token.GlobalSequenceTrackingToken;
import org.axonframework.messaging.eventhandling.processing.streaming.token.store.TokenStore;
import org.axonframework.messaging.eventstreaming.EventCriteria;
import org.axonframework.messaging.eventstreaming.Tag;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.ArrayList;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Proves AggregateBasedJpaEventStorageEngine in axon.aggregate_event_entry,
 * JpaTokenStore in axon.token_entry, Spring/JPA transactions, restart/replay,
 * token resume, and unique stream sequencing. Persistent Axon dead-letter
 * storage is NOT VERIFIED for Axon 5.3.1 and is not configured here.
 */
class AxonPersistenceRestartTest {
    private static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeAll
    static void startPostgres() {
        POSTGRES.start();
    }

    @AfterAll
    static void stopPostgres() {
        POSTGRES.stop();
    }

    @Test
    @DisplayName("Events, projection effects, and processor positions survive restart and replay @spec:AC-282")
    void eventsProjectionEffectsAndProcessorPositionsSurviveRestartAndReplay() {
        var streamId = "restart-" + UUID.randomUUID();
        var processor = "baseline-" + UUID.randomUUID();
        var eventIdentifier = UUID.randomUUID().toString();

        try (var first = startApplication()) {
            append(first.getBean(EventStorageEngine.class), streamId, eventIdentifier);
            first.getBean(TokenStore.class).initializeTokenSegments(
                processor, 1, new GlobalSequenceTrackingToken(7), null
            ).join();
            projectOnce(first.getBean(JdbcTemplate.class), eventIdentifier);
        }

        try (var restarted = startApplication()) {
            var events = source(restarted.getBean(EventStorageEngine.class), streamId);
            var resumed = restarted.getBean(TokenStore.class).fetchToken(processor, 0, null).join();
            restarted.getBean(TokenStore.class).releaseClaim(processor, 0, null).join();

            assertTrue(events.stream().anyMatch(event -> "persisted".equals(
                event.payloadAs(String.class)
            )));
            assertEquals(new GlobalSequenceTrackingToken(7), resumed);
            projectOnce(restarted.getBean(JdbcTemplate.class), eventIdentifier);
            assertEquals(1, restarted.getBean(JdbcTemplate.class).queryForObject(
                "select handled_count from axon.persistence_probe_projection where event_identifier = ?",
                Integer.class,
                eventIdentifier
            ));
        }
    }

    @Test
    @DisplayName("Concurrent Axon writes preserve one stream consistency boundary @spec:AC-282")
    void concurrentAxonWritesPreserveOneStreamConsistencyBoundary() {
        var streamId = "concurrent-" + UUID.randomUUID();
        try (var firstReplica = startApplication(); var secondReplica = startApplication()) {
            var firstEngine = firstReplica.getBean(EventStorageEngine.class);
            var secondEngine = secondReplica.getBean(EventStorageEngine.class);
            var first = CompletableFuture.runAsync(
                () -> append(firstEngine, streamId, UUID.randomUUID().toString())
            );
            var second = CompletableFuture.runAsync(
                () -> append(secondEngine, streamId, UUID.randomUUID().toString())
            );
            var successes = java.util.stream.Stream.of(first, second).filter(this::completedSuccessfully).count();

            assertEquals(1, successes);
            assertEquals(1, source(firstEngine, streamId).stream()
                .filter(event -> "persisted".equals(event.payloadAs(String.class))).count());
        }
    }

    private void append(EventStorageEngine engine, String streamId, String eventIdentifier) {
        var criteria = EventCriteria.havingTags("baseline", streamId);
        var message = new GenericEventMessage(
            eventIdentifier,
            new MessageType("dev.desafio.transaction.baseline.Persisted", "1.0"),
            "persisted",
            java.util.Map.of(),
            java.time.Instant.now()
        );
        var transaction = engine.appendEvents(
            AppendCondition.withCriteria(criteria),
            null,
            new GenericTaggedEventMessage<>(message, Set.of(Tag.of("baseline", streamId)))
        ).join();
        transaction.commit().join();
    }

    private ArrayList<org.axonframework.messaging.eventhandling.EventMessage> source(
        EventStorageEngine engine,
        String streamId
    ) {
        return engine.source(SourcingCondition.conditionFor(
            EventCriteria.havingTags("baseline", streamId)
        )).collect(() -> new ArrayList<org.axonframework.messaging.eventhandling.EventMessage>(),
            ArrayList::add).join();
    }

    private boolean completedSuccessfully(CompletableFuture<Void> future) {
        try {
            future.join();
            return true;
        } catch (CompletionException expectedConflict) {
            return false;
        }
    }

    private void projectOnce(JdbcTemplate jdbc, String eventIdentifier) {
        jdbc.update("""
            insert into axon.persistence_probe_projection (event_identifier, handled_count)
            values (?, 1)
            on conflict (event_identifier) do nothing
            """, eventIdentifier);
    }

    private ConfigurableApplicationContext startApplication() {
        return new SpringApplicationBuilder(PaymentFederationApplication.class)
            .web(WebApplicationType.NONE)
            .profiles("test")
            .properties(
                "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "spring.datasource.username=" + POSTGRES.getUsername(),
                "spring.datasource.password=" + POSTGRES.getPassword(),
                "spring.jpa.hibernate.ddl-auto=validate",
                "spring.rabbitmq.listener.simple.auto-startup=false",
                "management.health.rabbit.enabled=false",
                "payment.provider.mode=deterministic"
            )
            .run();
    }
}
