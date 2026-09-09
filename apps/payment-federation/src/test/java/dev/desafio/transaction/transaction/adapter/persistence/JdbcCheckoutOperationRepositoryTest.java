package dev.desafio.transaction.transaction.adapter.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.checkout.CheckoutIdempotencyConflictException;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JdbcCheckoutOperationRepositoryTest {
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    private static DriverManagerDataSource dataSource;

    @BeforeAll
    static void startPostgres() {
        POSTGRES.start();
        dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.postgresql.Driver");
        dataSource.setUrl(POSTGRES.getJdbcUrl());
        dataSource.setUsername(POSTGRES.getUsername());
        dataSource.setPassword(POSTGRES.getPassword());
        Flyway.configure()
            .dataSource(dataSource)
            .defaultSchema("axon")
            .schemas("axon", "transaction", "inventory", "payment")
            .locations("classpath:db/migration")
            .load()
            .migrate();
    }

    @AfterAll
    static void stopPostgres() {
        POSTGRES.stop();
    }

    @Test
    @DisplayName("PostgreSQL grants one checkout lease and survives repository restart @spec:AC-285 @spec:AC-292 @spec:AC-229")
    void postgresGrantsOneCheckoutLeaseAndSurvivesRepositoryRestart() {
        var operationKey = "operation-" + java.util.UUID.randomUUID();
        var request = new CheckoutOperationRepository.ClaimRequest(
            "buyer-1", operationKey, "a".repeat(64), "reference-" + operationKey
        );
        var first = new JdbcCheckoutOperationRepository(dataSource, new ObjectMapper());
        var second = new JdbcCheckoutOperationRepository(dataSource, new ObjectMapper());
        var now = Instant.parse("2026-09-09T12:00:00Z");

        var claims = List.of(
            CompletableFuture.supplyAsync(() -> first.claim(request, now, Duration.ofSeconds(30))),
            CompletableFuture.supplyAsync(() -> second.claim(request, now, Duration.ofSeconds(30)))
        ).stream().map(CompletableFuture::join).toList();

        assertEquals(1, claims.stream().filter(claim -> claim.ownerToken() != null).count());
        assertEquals(1, claims.stream().map(claim -> claim.operation().transactionId()).distinct().count());
        var claimed = claims.stream().filter(claim -> claim.ownerToken() != null).findFirst().orElseThrow();
        first.beginWooCreation(claimed.operation().transactionId(), claimed.ownerToken(), now);
        var order = new WooCommerceOrderPort.Order(
            "woo-42", List.of(new Transaction.Item("1001", 1)), new BigDecimal("19.90"), "BRL"
        );
        first.recordWooOrder(claimed.operation().transactionId(), claimed.ownerToken(), order, now);
        first.complete(claimed.operation().transactionId(), claimed.ownerToken(), now);

        var restarted = new JdbcCheckoutOperationRepository(dataSource, new ObjectMapper())
            .claim(request, now.plusSeconds(60), Duration.ofSeconds(30));
        assertNull(restarted.ownerToken());
        assertEquals(CheckoutOperationRepository.Status.COMPLETED, restarted.operation().status());
        assertEquals("woo-42", restarted.operation().wooOrderId());

        assertThrows(CheckoutIdempotencyConflictException.class, () -> restartedRepository().claim(
            new CheckoutOperationRepository.ClaimRequest(
                "buyer-2", operationKey, "b".repeat(64), request.wooReference()
            ), now.plusSeconds(60), Duration.ofSeconds(30)
        ));
    }

    @Test
    @DisplayName("Expired checkout lease is recovered for Woo reconciliation @spec:AC-285")
    void expiredCheckoutLeaseIsRecoveredForWooReconciliation() throws Exception {
        var operationKey = "operation-" + java.util.UUID.randomUUID();
        var request = new CheckoutOperationRepository.ClaimRequest(
            "buyer-1", operationKey, "a".repeat(64), "reference-" + operationKey
        );
        var repository = restartedRepository();
        var now = Instant.parse("2026-09-09T12:00:00Z");
        var first = repository.claim(request, now, Duration.ofSeconds(30));
        repository.beginWooCreation(first.operation().transactionId(), first.ownerToken(), now);
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(
            "update transaction.checkout_operation set lease_until = ? where operation_key = ?"
        )) {
            statement.setTimestamp(1, Timestamp.from(now.minusSeconds(1)));
            statement.setString(2, operationKey);
            statement.executeUpdate();
        }

        var recovered = restartedRepository().claim(request, now, Duration.ofSeconds(30));

        assertNotNull(recovered.ownerToken());
        assertEquals(CheckoutOperationRepository.Status.CREATING_WOO, recovered.operation().status());
    }

    private static JdbcCheckoutOperationRepository restartedRepository() {
        return new JdbcCheckoutOperationRepository(dataSource, new ObjectMapper());
    }
}
