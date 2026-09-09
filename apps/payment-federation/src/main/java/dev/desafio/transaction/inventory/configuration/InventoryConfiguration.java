package dev.desafio.transaction.inventory.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryRepository;
import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryOutbox;
import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryProjectionRepository;
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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.net.URI;
import java.time.Clock;

@Configuration(proxyBeanMethods = false)
public class InventoryConfiguration {
    @Bean
    Clock inventoryClock() {
        return Clock.systemUTC();
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    InventoryRepository inventoryRepository(DataSource dataSource) {
        return new JdbcInventoryRepository(dataSource);
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
    InventoryProjectionRepository inventoryProjectionRepository(DataSource dataSource) {
        return new JdbcInventoryProjectionRepository(dataSource);
    }

    @Bean
    @ConditionalOnProperty(name = "spring.datasource.url")
    InventoryOutbox inventoryOutbox(DataSource dataSource, ObjectMapper json) {
        return new JdbcInventoryOutbox(dataSource, json);
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
    CommitInventoryCommandHandler commitInventoryCommandHandler(Clock clock) {
        return new CommitInventoryCommandHandler(clock);
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
        if (value == null || value.isBlank()) throw new IllegalStateException(name + " is required");
        return value;
    }
}
