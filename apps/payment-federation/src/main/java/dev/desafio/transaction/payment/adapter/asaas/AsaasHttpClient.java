package dev.desafio.transaction.payment.adapter.asaas;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.payment.configuration.AsaasProperties;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;

class AsaasHttpClient {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpClient http;
    private final AsaasProperties properties;

    AsaasHttpClient(AsaasProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(properties.connectionTimeoutMillis()))
            .build();
    }

    AsaasProperties properties() {
        return properties;
    }

    JsonNode get(String path) {
        return send(request(path).GET());
    }

    JsonNode post(String path, Map<String, ?> body) {
        try {
            var json = JSON.writeValueAsString(body);
            return send(request(path)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json)));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to serialize Asaas request body", exception);
        }
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder()
            .uri(URI.create(properties.apiBaseUrl().toString() + path))
            .timeout(Duration.ofMillis(properties.readTimeoutMillis()))
            .header("access_token", properties.apiKey())
            .header("Accept", "application/json");
    }

    private JsonNode send(HttpRequest.Builder builder) {
        try {
            var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            var body = JSON.readTree(response.body());
            if (response.statusCode() >= 400) {
                throw new IllegalStateException("Asaas API error " + response.statusCode() + ": " + response.body());
            }
            return body;
        } catch (IOException exception) {
            throw new IllegalStateException("Asaas API call failed", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Asaas API call interrupted", exception);
        }
    }
}
