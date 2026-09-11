package dev.desafio.transaction.transaction.application.command;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.domain.TransactionErrorMessages;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.TreeMap;

public final class CheckoutCommandHash {
    private static final ObjectMapper JSON = new ObjectMapper();

    private CheckoutCommandHash() {}

    public static String hash(CheckoutCommand command) {
        var semanticCommand = new TreeMap<String, String>();
        semanticCommand.put("paymentMethod", command.paymentMethod());
        if (command.paymentMethodId() != null) semanticCommand.put("paymentMethodId", command.paymentMethodId());
        semanticCommand.put("payerEmail", command.payerEmail());
        if (command.providerToken() != null) semanticCommand.put("providerToken", command.providerToken());
        return sha256(semanticCommand);
    }

    public static String wooReference(String subject, String operationKey) {
        return "order-workflow-" + sha256(new TreeMap<>(Map.of(
            "operationKey", operationKey,
            "subject", subject
        )));
    }

    private static String sha256(Object value) {
        try {
            var bytes = JSON.writeValueAsBytes(value);
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (JsonProcessingException | NoSuchAlgorithmException error) {
            throw new IllegalStateException(TransactionErrorMessages.CHECKOUT_COMMAND_HASH_FAILED, error);
        }
    }
}
