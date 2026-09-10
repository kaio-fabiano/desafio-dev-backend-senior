package dev.desafio.transaction.shared.infrastructure.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;

import java.io.IOException;
import java.util.Set;

public final class IntegrationEventJson {
    private static final Set<String> FORBIDDEN_CREDENTIAL_FIELDS = Set.of(
        "providerToken", "accessToken", "cardToken"
    );

    private final ObjectMapper json;

    public IntegrationEventJson(ObjectMapper json) {
        this.json = json;
    }

    public IntegrationEventEnvelope<JsonNode> read(byte[] body) throws IOException {
        var tree = json.readTree(body);
        rejectReusableCredentials(tree.path("payload"));
        return json.readValue(
            body,
            new TypeReference<IntegrationEventEnvelope<JsonNode>>() {}
        );
    }

    public byte[] write(IntegrationEventEnvelope<JsonNode> event) {
        rejectReusableCredentials(event.payload());
        try {
            return json.writeValueAsBytes(event);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException(MessagingErrorMessages.SERIALIZATION_FAILED, error);
        }
    }

    private void rejectReusableCredentials(JsonNode node) {
        if (node == null || node.isMissingNode()) return;
        if (node.isObject()) {
            node.fieldNames().forEachRemaining(field -> {
                if (FORBIDDEN_CREDENTIAL_FIELDS.contains(field)) {
                    throw new IllegalArgumentException(MessagingErrorMessages.REUSABLE_CREDENTIALS);
                }
                rejectReusableCredentials(node.get(field));
            });
        } else if (node.isArray()) {
            node.forEach(this::rejectReusableCredentials);
        }
    }
}
