package dev.desafio.transaction.payment.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArchitectureBoundariesTest {
    @Test
    @DisplayName("AC-169: Java dependencies point inward from clean architecture packages @spec:AC-169")
    void dependenciesPointInward() throws IOException {
        var root = Path.of("src/main/java/dev/desafio/transaction");
        var sources = new ArrayList<Path>();
        var contexts = new HashSet<String>();
        try (var paths = Files.walk(root)) {
            paths.filter(path -> path.toString().endsWith(".java")).forEach(sources::add);
        }

        assertFalse(sources.isEmpty());
        for (var path : sources) {
            var normalized = path.toString().replace('\\', '/');
            var source = Files.readString(path);
            if (normalized.contains("/transaction/payment/")) contexts.add("payment");
            if (normalized.contains("/transaction/inventory/")) contexts.add("inventory");
            assertTrue(normalized.matches(".*/(payment|inventory)/(domain|application|adapter|configuration)/.*\\.java")
                || normalized.endsWith("/transaction/PaymentFederationApplication.java"));
            if (normalized.contains("/domain/")) {
                assertFalse(source.matches(
                    "(?s).*import (org\\.springframework|com\\.mercadopago|com\\.rabbitmq|java\\.sql).*"
                ));
            }
            if (normalized.contains("/application/")) {
                assertFalse(source.matches(
                    "(?s).*import (org\\.springframework|com\\.mercadopago|dev\\.desafio\\.transaction\\.(payment|inventory)\\.adapter).*"
                ));
            }
        }
        assertTrue(contexts.containsAll(java.util.Set.of("payment", "inventory")));
    }
}
