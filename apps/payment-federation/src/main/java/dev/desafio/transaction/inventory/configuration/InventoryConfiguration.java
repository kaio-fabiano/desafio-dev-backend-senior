package dev.desafio.transaction.inventory.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.inventory.adapter.persistence.JdbcInventoryRepository;
import dev.desafio.transaction.inventory.adapter.wordpress.WooInventoryAdapter;
import dev.desafio.transaction.inventory.application.InventoryRepository;
import dev.desafio.transaction.inventory.application.InventoryService;
import dev.desafio.transaction.inventory.application.StockPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.net.URI;

@Configuration(proxyBeanMethods = false)
public class InventoryConfiguration {
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

    private static String requiredEnvironment(String name) {
        var value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException(name + " is required");
        return value;
    }
}
