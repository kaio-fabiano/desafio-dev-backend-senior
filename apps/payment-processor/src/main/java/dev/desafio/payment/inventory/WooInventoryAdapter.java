package dev.desafio.payment.inventory;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

public final class WooInventoryAdapter implements InventoryService.StockPort {
    private final URI endpoint;
    private final HttpClient client;
    private final ObjectMapper json;

    public WooInventoryAdapter(URI endpoint, ObjectMapper json) {
        this(endpoint, json, HttpClient.newHttpClient());
    }

    WooInventoryAdapter(
        URI endpoint,
        ObjectMapper json,
        HttpClient client
    ) {
        this.endpoint = endpoint;
        this.json = json;
        this.client = client;
    }

    @Override
    public void reserve(InventoryService.ReservationRequested request) {
        assertAvailable(request);
        var operation = Map.of(
            "operationName", "ReserveOrderInventory",
            "query", "mutation ReserveOrderInventory($input: UpdateOrderInput!) { updateOrder(input: $input) { order { id status } } }",
            "variables", Map.of("input", Map.of(
                "clientMutationId", request.operationKey(),
                "id", request.orderId(),
                "status", "PROCESSING"
            ))
        );
        var httpRequest = HttpRequest.newBuilder(endpoint)
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/json")
            .header("X-Authenticated-Subject", "payment-federation")
            .header("X-Authenticated-Scopes", "orders:write")
            .POST(HttpRequest.BodyPublishers.ofString(write(operation)))
            .build();
        try {
            var response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            var payload = json.readTree(response.body());
            var errors = payload.path("errors");
            if (errors.toString().toLowerCase().matches(".*(insufficient|out of stock|stock).*")) {
                throw new InventoryService.InsufficientStockException();
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300 || !errors.isMissingNode() && !errors.isEmpty()) {
                throw new IllegalStateException("WordPress federation inventory request failed: " + response.statusCode());
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("WooCommerce inventory request interrupted", error);
        } catch (IOException error) {
            throw new IllegalStateException("WordPress federation inventory request failed", error);
        }
    }

    private void assertAvailable(InventoryService.ReservationRequested request) {
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
                throw new IllegalStateException("WordPress federation did not resolve product " + item.productId());
            }
            if ("OUT_OF_STOCK".equals(product.path("stockStatus").asText())
                || product.path("stockQuantity").isInt()
                && product.path("stockQuantity").asInt() < item.quantity()) {
                throw new InventoryService.InsufficientStockException();
            }
        }
    }

    private com.fasterxml.jackson.databind.JsonNode send(Object operation) {
        var request = HttpRequest.newBuilder(endpoint)
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/json")
            .header("X-Authenticated-Subject", "payment-federation")
            .header("X-Authenticated-Scopes", "orders:write")
            .POST(HttpRequest.BodyPublishers.ofString(write(operation)))
            .build();
        try {
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            var payload = json.readTree(response.body());
            var errors = payload.path("errors");
            if (response.statusCode() < 200 || response.statusCode() >= 300 || !errors.isMissingNode() && !errors.isEmpty()) {
                throw new IllegalStateException("WordPress federation inventory query failed: " + response.statusCode());
            }
            return payload;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("WooCommerce inventory request interrupted", error);
        } catch (IOException error) {
            throw new IllegalStateException("WordPress federation inventory request failed", error);
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
