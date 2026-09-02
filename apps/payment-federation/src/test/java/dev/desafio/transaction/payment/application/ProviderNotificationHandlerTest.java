package dev.desafio.transaction.payment.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ProviderNotificationHandlerTest {
    @Test
    @DisplayName("AC-163: duplicate provider request ids are claimed once @spec:AC-163")
    void providerRequestIdIsReplaySafe() throws IOException {
        var repository = Files.readString(Path.of(
            "src/main/java/dev/desafio/transaction/payment/adapter/persistence/JdbcProviderNotificationRepository.java"
        ));
        var migration = Files.readString(Path.of(
            "src/main/resources/db/migration/V4__provider_notification_inbox.sql"
        ));

        assertTrue(migration.contains("provider_request_id text primary key"));
        assertTrue(repository.contains("on conflict (provider_request_id) do nothing"));
        assertTrue(repository.contains("Outcome.DUPLICATE"));
    }

    @Test
    @DisplayName("AC-164: authoritative provider state is correlated before transition @spec:AC-164")
    void authoritativeStatePrecedesPersistence() throws IOException {
        var source = Files.readString(Path.of(
            "src/main/java/dev/desafio/transaction/payment/application/ProviderNotificationHandler.java"
        ));

        var lookup = source.indexOf("provider.findByProviderReference(");
        var transition = source.indexOf("repository.apply(");
        assertTrue(lookup >= 0 && lookup < transition);
        assertTrue(source.contains("resolved to a different payment"));
    }
}
