package dev.desafio.transaction.inventory.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.inventory.adapter.persistence.InventoryAmqpOutboxJpaRepository;
import dev.desafio.transaction.inventory.adapter.persistence.InventoryInboxJpaRepository;
import dev.desafio.transaction.inventory.adapter.persistence.InventoryOperationJpaRepository;
import dev.desafio.transaction.inventory.adapter.persistence.InventoryReservationProjectionJpaRepository;
import dev.desafio.transaction.inventory.adapter.persistence.InventoryResultEventJpaRepository;
import dev.desafio.transaction.inventory.adapter.persistence.JpaInventoryOutbox;
import dev.desafio.transaction.inventory.adapter.persistence.JpaInventoryProjectionRepository;
import dev.desafio.transaction.inventory.adapter.persistence.JpaInventoryRepository;
import dev.desafio.transaction.inventory.adapter.persistence.JpaInventoryViewRepository;
import dev.desafio.transaction.inventory.adapter.wordpress.WooInventoryAdapter;
import dev.desafio.transaction.inventory.application.InventoryRepository;
import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.application.StockPort;
import dev.desafio.transaction.inventory.application.command.CommitInventoryCommandHandler;
import dev.desafio.transaction.inventory.application.command.ReleaseInventoryCommandHandler;
import dev.desafio.transaction.inventory.application.command.ReserveInventoryCommandHandler;
import dev.desafio.transaction.inventory.application.event.InventoryIntegrationEventHandler;
import dev.desafio.transaction.inventory.application.event.InventoryOutbox;
import dev.desafio.transaction.inventory.application.event.InventoryProjectionHandler;
import dev.desafio.transaction.inventory.application.query.FindInventoryReservationQueryHandler;
import dev.desafio.transaction.inventory.application.query.InventoryProjectionRepository;
import dev.desafio.transaction.inventory.application.query.InventoryViewRepository;
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.net.URI;
import java.time.Clock;

@Configuration(proxyBeanMethods = false)
public class InventoryConfiguration {
    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    InventoryRepository inventoryRepository(
        InventoryOperationJpaRepository operations,
        InventoryResultEventJpaRepository results,
        InventoryInboxJpaRepository inbox,
        @Qualifier("transactionManager") PlatformTransactionManager transactions,
        Clock clock
    ) {
        return new JpaInventoryRepository(operations, results, inbox, transactions, clock);
    }

    @Bean
    @ConditionalOnProperty(name = {"spring.datasource.url", "wordpress.graphql-url"})
    StockPort wooInventoryAdapter(ObjectMapper json) {
        return new WooInventoryAdapter(
            URI.create(requiredEnvironment("WORDPRESS_GRAPHQL_URL")),
            requiredEnvironment("WPGRAPHQL_SITE_TOKEN"),
            json
        );
    }

    @Bean
    @ConditionalOnProperty(name = {"spring.datasource.url", "wordpress.graphql-url"})
    InventoryService inventoryService(InventoryRepository repository, StockPort stock) {
        return new InventoryService(repository, stock);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    InventoryProjectionRepository inventoryProjectionRepository(
        InventoryReservationProjectionJpaRepository projections,
        @Qualifier("transactionManager") PlatformTransactionManager transactions
    ) {
        return new JpaInventoryProjectionRepository(projections, transactions);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    InventoryViewRepository inventoryViewRepository(
        InventoryReservationProjectionJpaRepository projections
    ) {
        return new JpaInventoryViewRepository(projections);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    InventoryOutbox inventoryOutbox(
        InventoryAmqpOutboxJpaRepository outbox,
        ObjectMapper json,
        @Qualifier("transactionManager") PlatformTransactionManager transactions
    ) {
        return new JpaInventoryOutbox(outbox, json, transactions);
    }

    @Bean
    @ConditionalOnProperty(name = {"spring.datasource.url", "wordpress.graphql-url"})
    ReserveInventoryCommandHandler reserveInventoryCommandHandler(
        InventoryService inventory,
        Clock clock
    ) {
        return new ReserveInventoryCommandHandler(inventory, clock);
    }

    @Bean
    CommitInventoryCommandHandler commitInventoryCommandHandler(Clock clock, java.util.Optional<StockPort> stock) {
        return new CommitInventoryCommandHandler(
            clock, (reservationId, items) -> stock.map(port -> port.isAvailable(items)).orElse(true)
        );
    }

    @Bean
    ReleaseInventoryCommandHandler releaseInventoryCommandHandler(Clock clock) {
        return new ReleaseInventoryCommandHandler(clock);
    }

    @Bean
    @ConditionalOnBean(InventoryProjectionRepository.class)
    @ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "true", matchIfMissing = true)
    InventoryProjectionHandler inventoryProjectionHandler(InventoryProjectionRepository projections) {
        return new InventoryProjectionHandler(projections);
    }

    @Bean
    @ConditionalOnBean(InventoryOutbox.class)
    @ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "true", matchIfMissing = true)
    InventoryIntegrationEventHandler inventoryIntegrationEventHandler(InventoryOutbox outbox) {
        return new InventoryIntegrationEventHandler(outbox);
    }

    @Bean
    @ConditionalOnBean(InventoryProjectionRepository.class)
    FindInventoryReservationQueryHandler findInventoryReservationQueryHandler(
        InventoryProjectionRepository projections
    ) {
        return new FindInventoryReservationQueryHandler(projections);
    }

    private static String requiredEnvironment(String name) {
        var value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(InventoryErrorMessages.required(name));
        }
        return value;
    }
}
