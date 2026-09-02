package dev.desafio.transaction.payment.adapter.wordpress;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.payment.application.command.AuthorizePayment;
import dev.desafio.transaction.payment.application.command.OrderPaymentPort;
import dev.desafio.transaction.payment.application.query.PaymentView;
import dev.desafio.transaction.payment.domain.Payment;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class WordPressOrderPaymentAdapter implements OrderPaymentPort {
    private final URI endpoint;
    private final String siteToken;
    private final ObjectMapper json;
    private final HttpClient client;

    public WordPressOrderPaymentAdapter(URI endpoint, String siteToken, ObjectMapper json) {
        this(endpoint, siteToken, json, HttpClient.newHttpClient());
    }

    WordPressOrderPaymentAdapter(URI endpoint, String siteToken, ObjectMapper json, HttpClient client) {
        this.endpoint = java.util.Objects.requireNonNull(endpoint, "endpoint");
        this.siteToken = requireText(siteToken, "siteToken");
        this.json = java.util.Objects.requireNonNull(json, "json");
        this.client = java.util.Objects.requireNonNull(client, "client");
    }

    @Override
    public void record(AuthorizePayment command, PaymentView payment) {
        var input = new LinkedHashMap<String, Object>();
        input.put("clientMutationId", command.operationKey());
        input.put("id", command.orderId());
        var metadata = new ArrayList<>(List.of(
            Map.of("key", "operation_key", "value", command.operationKey())
        ));
        if (payment.method() == Payment.Method.CARD && payment.status() == Payment.Status.AUTHORIZED) {
            input.put("isPaid", true);
            input.put("transactionId", payment.providerReference());
        } else if (payment.status() == Payment.Status.PIX_GENERATED) {
            metadata.add(Map.of("key", "payment_state", "value", "PIX_GENERATED"));
            metadata.add(Map.of("key", "pix_code", "value", payment.pixCode()));
        }
        input.put("metaData", metadata);
        var operation = Map.of(
            "operationName", "UpdateOrderPayment",
            "query", "mutation UpdateOrderPayment($input: UpdateOrderInput!) { updateOrder(input: $input) { order { id status transactionId } } }",
            "variables", Map.of("input", input)
        );
        try {
            var request = HttpRequest.newBuilder(endpoint)
                .header("Content-Type", "application/json")
                .header("Origin", endpoint.resolve("/").toString().replaceAll("/$", ""))
                .header("Authorization", "Bearer " + WpGraphqlAuthentication.bearerToken(endpoint, siteToken, json, client))
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(operation)))
                .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            var payload = json.readTree(response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300
                || !payload.path("errors").isMissingNode()) {
                throw new IllegalStateException("WordPress federation payment update failed: " + response.statusCode());
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("WordPress federation payment update interrupted", exception);
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("WordPress federation payment update failed", exception);
        }
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
