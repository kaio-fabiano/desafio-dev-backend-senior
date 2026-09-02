package dev.desafio.transaction.inventory.adapter.wordpress;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.inventory.application.StockPort;
import dev.desafio.transaction.inventory.domain.Inventory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

public final class WooInventoryAdapter implements StockPort {
    private static final String SERVICE_IDENTITY = "payment-federation";

    private final URI endpoint;
    private final HttpClient client;
    private final ObjectMapper json;
    private final String siteToken;

    public WooInventoryAdapter(URI endpoint, String siteToken, ObjectMapper json) {
        this(endpoint, siteToken, json, HttpClient.newHttpClient());
    }

    WooInventoryAdapter(
        URI endpoint,
        String siteToken,
        ObjectMapper json,
        HttpClient client
    ) {
        this.endpoint = endpoint;
        this.siteToken = siteToken;
        this.json = json;
        this.client = client;
    }

    @Override
    public void reserve(Inventory.ReservationRequested request) {
        assertAvailable(request);
        var operation = Map.of(
            "operationName", "ReserveOrderInventory",
            "query", "mutation ReserveOrderInventory($input: UpdateOrderInput!) { updateOrder(input: $input) { order { id status } } }",
            "variables", Map.of("input", Map.of(
                "clientMutationId", request.operationKey(),
                "id", request.orderId(),
                "status", "PROCESSING",
                "metaData", java.util.List.of(Map.of(
                    "key", "inventory_operation_key",
                    "value", request.operationKey()
                ))
            ))
        );
        var httpRequest = request(operation);
        try {
            var response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            var payload = json.readTree(response.body());
            var errors = payload.path("errors");
            if (errors.toString().toLowerCase().matches(".*(insufficient|out of stock|stock).*")) {
                throw new Inventory.InsufficientStockException();
            }
            if (response.statusCode() < 200
                || response.statusCode() >= 300
                || !errors.isMissingNode() && !errors.isEmpty()) {
                throw new IllegalStateException(
                    "WordPress federation inventory request failed: " + response.statusCode()
                );
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("WooCommerce inventory request interrupted", error);
        } catch (IOException error) {
            throw new IllegalStateException("WordPress federation inventory request failed", error);
        }
    }

    @Override
    public Inventory.StockState reconcile(Inventory.ReservationRequested request) {
        var operation = Map.of(
            "operationName", "InventoryOperationState",
            "query", "query InventoryOperationState($id: ID!) { order(id: $id, idType: DATABASE_ID) { status metaData { key value } } }",
            "variables", Map.of("id", request.orderId())
        );
        var order = send(operation).path("data").path("order");
        if (order.isMissingNode() || order.isNull()) {
            throw new IllegalStateException("WordPress federation did not resolve order " + request.orderId());
        }
        for (var metadata : order.path("metaData")) {
            if (!"inventory_operation_key".equals(metadata.path("key").asText())) continue;
            if (request.operationKey().equals(metadata.path("value").asText())) {
                return Inventory.StockState.RESERVED;
            }
            throw new Inventory.InventoryConflictException(request.orderId());
        }
        try {
            assertAvailable(request);
            return Inventory.StockState.AVAILABLE;
        } catch (Inventory.InsufficientStockException error) {
            return Inventory.StockState.INSUFFICIENT;
        }
    }

    private void assertAvailable(Inventory.ReservationRequested request) {
        for (var item : request.items()) {
            var globalId = Base64.getEncoder().encodeToString(
                ("post:" + item.productId()).getBytes(StandardCharsets.UTF_8)
            );
            var operation = Map.of(
                "operationName", "InventoryAvailability",
                "query", "query InventoryAvailability($id: ID!) { product(id: $id) { databaseId ... on SimpleProduct { stockQuantity stockStatus } ... on VariableProduct { stockQuantity stockStatus } } }",
                "variables", Map.of("id", globalId)
            );
            var product = send(operation).path("data").path("product");
            if (product.isMissingNode() || product.isNull()) {
                throw new IllegalStateException(
                    "WordPress federation did not resolve product " + item.productId()
                );
            }
            if ("OUT_OF_STOCK".equals(product.path("stockStatus").asText())
                || product.path("stockQuantity").isInt()
                && product.path("stockQuantity").asInt() < item.quantity()) {
                throw new Inventory.InsufficientStockException();
            }
        }
    }

    private JsonNode send(Object operation) {
        try {
            var response = client.send(request(operation), HttpResponse.BodyHandlers.ofString());
            var payload = json.readTree(response.body());
            var errors = payload.path("errors");
            if (response.statusCode() < 200
                || response.statusCode() >= 300
                || !errors.isMissingNode() && !errors.isEmpty()) {
                throw new IllegalStateException(
                    "WordPress federation inventory query failed: "
                        + response.statusCode() + " " + errors
                );
            }
            return payload;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("WooCommerce inventory request interrupted", error);
        } catch (IOException error) {
            throw new IllegalStateException("WordPress federation inventory request failed", error);
        }
    }

    private HttpRequest request(Object operation) {
        return HttpRequest.newBuilder(endpoint)
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/json")
            .header("Origin", endpoint.resolve("/").toString().replaceAll("/$", ""))
            .header("Authorization", "Bearer " + bearerToken())
            .POST(HttpRequest.BodyPublishers.ofString(write(operation)))
            .build();
    }

    private String bearerToken() {
        var operation = Map.of(
            "operationName", "LoginWithSiteToken",
            "query", "mutation LoginWithSiteToken($identity: String!) { login(input: { provider: SITETOKEN, identity: $identity }) { authToken } }",
            "variables", Map.of("identity", SERVICE_IDENTITY)
        );
        try {
            var request = HttpRequest.newBuilder(endpoint)
                .header("Content-Type", "application/json")
                .header("Origin", endpoint.resolve("/").toString().replaceAll("/$", ""))
                .header("X-WPGraphQL-Site-Token", siteToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(operation)))
                .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            var payload = json.readTree(response.body());
            var token = payload.path("data").path("login").path("authToken").asText();
            if (response.statusCode() < 200 || response.statusCode() >= 300 || token.isBlank()) {
                throw new IllegalStateException(
                    "WordPress service authentication failed: " + response.statusCode()
                );
            }
            return token;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("WordPress service authentication interrupted", error);
        } catch (IOException error) {
            throw new IllegalStateException("WordPress service authentication failed", error);
        }
    }

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("inventory request could not be serialized", error);
        }
    }
}
