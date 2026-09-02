package dev.desafio.transaction.payment.adapter.wordpress;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

public final class WpGraphqlAuthentication {
    private static final String SERVICE_IDENTITY = "payment-federation";

    private WpGraphqlAuthentication() {}

    public static String bearerToken(URI endpoint, String siteToken, ObjectMapper json, HttpClient client) {
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
                throw new IllegalStateException("WordPress service authentication failed: " + response.statusCode());
            }
            return token;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("WordPress service authentication interrupted", error);
        } catch (IOException error) {
            throw new IllegalStateException("WordPress service authentication failed", error);
        }
    }
}
