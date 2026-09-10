package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.application.command.CommitInventoryCommand;
import dev.desafio.transaction.inventory.application.command.CommitInventoryCommandHandler;
import dev.desafio.transaction.inventory.application.command.ReleaseInventoryCommandHandler;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommand;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommandHandler;
import dev.desafio.transaction.inventory.application.axon.InventoryCommittedAxonEvent;
import dev.desafio.transaction.inventory.application.axon.InventoryEventSourcedEntity;
import dev.desafio.transaction.inventory.application.axon.InventoryReservedAxonEvent;
import dev.desafio.transaction.inventory.application.query.FindInventoryReservationQuery;
import dev.desafio.transaction.inventory.application.query.FindInventoryReservationQueryHandler;
import dev.desafio.transaction.inventory.application.query.InventoryProjectionRepository;
import dev.desafio.transaction.inventory.application.query.InventoryReservationView;
import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.inventory.domain.InventoryReservation;
import dev.desafio.transaction.inventory.domain.StockItem;
import dev.desafio.transaction.inventory.domain.event.InventoryCommittedEvent;
import dev.desafio.transaction.inventory.domain.event.InventoryReservedEvent;
import org.axonframework.eventsourcing.configuration.EventSourcedEntityModule;
import org.axonframework.eventsourcing.configuration.EventSourcingConfigurer;
import org.axonframework.messaging.commandhandling.configuration.CommandHandlingModule;
import org.axonframework.test.fixture.AxonTestFixture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InventoryAxonPathsTest {
    private static final Instant NOW = Instant.parse("2026-09-09T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private AxonTestFixture fixture;

    @AfterEach
    void stopFixture() {
        if (fixture != null) fixture.stop();
    }

    @Test
    @DisplayName("Commands append Inventory events and queries read a dedicated view @spec:AC-281")
    void commandsAndQueriesUseDistinctPaths() {
        fixture = fixture();
        var eventId = UUID.randomUUID();
        var command = new ReserveInventoryCommand(
            "tx-246", eventId, "reserve-246", "tx-246", "order-246",
            List.of(new StockItem("sku-1", 1)), "correlation", eventId.toString()
        );

        fixture.given().noPriorActivity().when().command(command).then().success().events(
            new InventoryReservedAxonEvent("tx-246", new InventoryReservedEvent(
                "tx-246", "tx-246", "order-246", command.items(), 1,
                "correlation", eventId.toString(), NOW
            ))
        );

        var view = new InventoryReservationView(
            "tx-246", "tx-246", "order-246", InventoryReservation.Status.RESERVED,
            1, null, NOW
        );
        var query = new FindInventoryReservationQueryHandler(new InventoryProjectionRepository() {
            @Override
            public void save(InventoryReservationView ignored) {}

            @Override
            public Optional<InventoryReservationView> find(String ignored) {
                return Optional.of(view);
            }
        });
        assertEquals(Optional.of(view), query.handle(new FindInventoryReservationQuery("tx-246")));
    }

    @Test
    @DisplayName("Axon replays the Inventory stream before applying the next command @spec:AC-282")
    void axonReplaysBeforeTheNextCommand() {
        fixture = fixture();
        var reserved = new InventoryReservedEvent(
            "tx-246", "tx-246", "order-246", List.of(new StockItem("sku-1", 1)),
            1, "correlation", "order-received", NOW
        );

        fixture.given().event(new InventoryReservedAxonEvent("tx-246", reserved)).when().command(
            new CommitInventoryCommand("tx-246", "correlation", "payment-approved")
        ).then().success().events(
            new InventoryCommittedAxonEvent("tx-246", new InventoryCommittedEvent(
                "tx-246", "tx-246", "order-246", 2,
                "correlation", "payment-approved", NOW
            ))
        );
    }

    @Test
    @DisplayName("A duplicate transaction cannot change its Inventory reservation request @spec:AC-284")
    void duplicateTransactionCannotChangeItsRequest() {
        fixture = fixture();
        var reserved = new InventoryReservedAxonEvent("tx-246", new InventoryReservedEvent(
            "tx-246", "tx-246", "order-246", List.of(new StockItem("sku-1", 1)),
            1, "correlation", "order-received", NOW
        ));
        var conflicting = new ReserveInventoryCommand(
            "tx-246", UUID.randomUUID(), "reserve-conflict", "tx-246", "other-order",
            List.of(new StockItem("sku-2", 1)), "correlation", "duplicate"
        );

        fixture.given().event(reserved).when().command(conflicting).then().noEvents()
            .exceptionSatisfies(error -> assertTrue(hasCause(error, IllegalArgumentException.class)));
    }

    private AxonTestFixture fixture() {
        var effects = new InventoryService(new MemoryRepository(), request -> {} , CLOCK);
        var configurer = EventSourcingConfigurer.create()
            .registerEntity(EventSourcedEntityModule.autodetected(
                String.class, InventoryEventSourcedEntity.class
            ))
            .registerCommandHandlingModule(
                CommandHandlingModule.named("inventory-commands").commandHandlers()
                    .autodetectedCommandHandlingComponent(config ->
                        new ReserveInventoryCommandHandler(effects, CLOCK))
                    .autodetectedCommandHandlingComponent(config ->
                        new CommitInventoryCommandHandler(CLOCK))
                    .autodetectedCommandHandlingComponent(config ->
                        new ReleaseInventoryCommandHandler(CLOCK))
            );
        return AxonTestFixture.with(configurer);
    }

    private static boolean hasCause(Throwable error, Class<? extends Throwable> type) {
        for (var cause = error; cause != null && cause.getCause() != cause; cause = cause.getCause()) {
            if (type.isInstance(cause)) return true;
        }
        return false;
    }

    private static final class MemoryRepository implements InventoryRepository {
        private final Map<String, Inventory.OutgoingEvent> completed = new HashMap<>();

        @Override
        public Claim claim(Inventory.ReservationRequested request, String fingerprint) {
            var event = completed.get(request.operationKey());
            return event == null
                ? new Claim(ClaimStatus.ACQUIRED, request.eventId(), request.operationKey(), UUID.randomUUID(), null)
                : new Claim(ClaimStatus.COMPLETED, request.eventId(), request.operationKey(), null, event);
        }

        @Override
        public Inventory.OutgoingEvent complete(Claim claim, Inventory.OutgoingEvent event) {
            return completed.computeIfAbsent(claim.operationKey(), ignored -> event);
        }
    }
}
