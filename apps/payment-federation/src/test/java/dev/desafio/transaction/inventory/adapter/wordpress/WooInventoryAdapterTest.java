package dev.desafio.transaction.inventory.adapter.wordpress;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import dev.desafio.transaction.inventory.domain.Inventory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WooInventoryAdapterTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    @DisplayName("Inventory resolves WooCommerce products by database ID over its HTTP ACL @spec:AC-286 @spec:AC-293")
    void resolvesProductsByDatabaseId() throws Exception {
        var availability = new AtomicReference<com.fasterxml.jackson.databind.JsonNode>();
        var server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/graphql", exchange -> {
            var request = JSON.readTree(exchange.getRequestBody());
            var operation = request.path("operationName").asText();
            if ("InventoryAvailability".equals(operation)) availability.set(request);
            var body = switch (operation) {
                case "LoginWithSiteToken" -> "{\"data\":{\"login\":{\"authToken\":\"token\"}}}";
                case "InventoryAvailability" -> "{\"data\":{\"product\":{\"databaseId\":1001,\"stockQuantity\":2,\"stockStatus\":\"IN_STOCK\"}}}";
                default -> "{\"data\":{\"updateOrder\":{\"order\":{\"id\":\"order-1\",\"status\":\"PROCESSING\"}}}}";
            };
            var response = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            var adapter = new WooInventoryAdapter(
                java.net.URI.create("http://localhost:" + server.getAddress().getPort() + "/graphql"),
                "site-token",
                JSON
            );
            adapter.reserve(new Inventory.ReservationRequested(
                java.util.UUID.randomUUID(), "operation-1", "order-1",
                List.of(new Inventory.StockItem("1001", 1))
            ));

            assertEquals("1001", availability.get().path("variables").path("id").asText());
            assertTrue(availability.get().path("query").asText().contains("idType: DATABASE_ID"));
        } finally {
            server.stop(0);
        }
    }
}
