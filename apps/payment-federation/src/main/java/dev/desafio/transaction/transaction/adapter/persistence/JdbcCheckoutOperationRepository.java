package dev.desafio.transaction.transaction.adapter.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.checkout.CheckoutIdempotencyConflictException;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import dev.desafio.transaction.transaction.domain.Transaction;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public final class JdbcCheckoutOperationRepository implements CheckoutOperationRepository {
    private final DataSource dataSource;
    private final ObjectMapper json;

    public JdbcCheckoutOperationRepository(DataSource dataSource, ObjectMapper json) {
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
        this.json = Objects.requireNonNull(json, "json");
    }

    @Override
    public Claim claim(ClaimRequest request, Instant now, Duration lease) {
        Objects.requireNonNull(request, "request");
        Objects.requireNonNull(now, "now");
        Objects.requireNonNull(lease, "lease");
        var transactionId = UUID.randomUUID().toString();
        var ownerToken = UUID.randomUUID();
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                var acquired = insert(connection, request, transactionId, ownerToken, now.plus(lease));
                if (!acquired) acquired = reclaim(connection, request.operationKey(), ownerToken, now, now.plus(lease));
                var operation = read(connection, request.operationKey());
                if (!operation.subject().equals(request.subject())
                    || !operation.commandHash().equals(request.commandHash())) {
                    throw new CheckoutIdempotencyConflictException();
                }
                connection.commit();
                return new Claim(
                    operation,
                    acquired && operation.status() != Status.COMPLETED ? ownerToken.toString() : null
                );
            } catch (RuntimeException | SQLException error) {
                rollback(connection, error);
                if (error instanceof RuntimeException runtime) throw runtime;
                throw new IllegalStateException("checkout claim transaction failed", error);
            }
        } catch (SQLException error) {
            throw new IllegalStateException("checkout database is unavailable", error);
        }
    }

    @Override
    public void beginWooCreation(String transactionId, String ownerToken, Instant now) {
        updateOwned(
            "status = 'CREATING_WOO', updated_at = ?",
            transactionId,
            ownerToken,
            now,
            Status.PENDING_WOO,
            Timestamp.from(now)
        );
    }

    @Override
    public Operation recordWooOrder(
        String transactionId,
        String ownerToken,
        WooCommerceOrderPort.Order order,
        Instant now
    ) {
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement("""
            update transaction.checkout_operation
               set woo_order_id = ?, items = cast(? as jsonb), amount = ?, currency = ?,
                   status = 'WOO_CONFIRMED', updated_at = ?
             where transaction_id = ? and owner_token = cast(? as uuid)
               and status = 'CREATING_WOO' and lease_until > ?
            """)) {
            statement.setString(1, order.id());
            statement.setString(2, writeItems(order.items()));
            statement.setBigDecimal(3, order.amount());
            statement.setString(4, order.currency());
            statement.setTimestamp(5, Timestamp.from(now));
            statement.setString(6, transactionId);
            statement.setString(7, ownerToken);
            statement.setTimestamp(8, Timestamp.from(now));
            if (statement.executeUpdate() != 1) throw new IllegalStateException("checkout lease was lost");
            return read(connection, transactionId, true);
        } catch (SQLException error) {
            throw new IllegalStateException("Woo order confirmation could not be persisted", error);
        }
    }

    @Override
    public Operation complete(String transactionId, String ownerToken, Instant now) {
        updateOwned(
            "status = 'COMPLETED', owner_token = null, lease_until = null, updated_at = ?",
            transactionId,
            ownerToken,
            now,
            Status.WOO_CONFIRMED,
            Timestamp.from(now)
        );
        try (var connection = dataSource.getConnection()) {
            return read(connection, transactionId, true);
        } catch (SQLException error) {
            throw new IllegalStateException("completed checkout could not be read", error);
        }
    }

    @Override
    public void release(String transactionId, String ownerToken, Instant now) {
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement("""
            update transaction.checkout_operation
               set owner_token = null, lease_until = null, updated_at = ?
             where transaction_id = ? and owner_token = cast(? as uuid) and status <> 'COMPLETED'
            """)) {
            statement.setTimestamp(1, Timestamp.from(now));
            statement.setString(2, transactionId);
            statement.setString(3, ownerToken);
            statement.executeUpdate();
        } catch (SQLException error) {
            throw new IllegalStateException("checkout lease could not be released", error);
        }
    }

    private boolean insert(
        Connection connection,
        ClaimRequest request,
        String transactionId,
        UUID ownerToken,
        Instant leaseUntil
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            insert into transaction.checkout_operation (
                transaction_id, operation_key, subject, command_hash, woo_reference,
                status, owner_token, lease_until
            ) values (?, ?, ?, ?, ?, 'PENDING_WOO', ?, ?)
            on conflict do nothing
            """)) {
            statement.setString(1, transactionId);
            statement.setString(2, request.operationKey());
            statement.setString(3, request.subject());
            statement.setString(4, request.commandHash());
            statement.setString(5, request.wooReference());
            statement.setObject(6, ownerToken);
            statement.setTimestamp(7, Timestamp.from(leaseUntil));
            return statement.executeUpdate() == 1;
        }
    }

    private boolean reclaim(
        Connection connection,
        String operationKey,
        UUID ownerToken,
        Instant now,
        Instant leaseUntil
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            update transaction.checkout_operation
               set owner_token = ?, lease_until = ?, updated_at = ?
             where operation_key = ? and status <> 'COMPLETED'
               and (owner_token is null or lease_until <= ?)
            """)) {
            statement.setObject(1, ownerToken);
            statement.setTimestamp(2, Timestamp.from(leaseUntil));
            statement.setTimestamp(3, Timestamp.from(now));
            statement.setString(4, operationKey);
            statement.setTimestamp(5, Timestamp.from(now));
            return statement.executeUpdate() == 1;
        }
    }

    private Operation read(Connection connection, String identity) throws SQLException {
        return read(connection, identity, false);
    }

    private Operation read(Connection connection, String identity, boolean byTransactionId) throws SQLException {
        var column = byTransactionId ? "transaction_id" : "operation_key";
        try (var statement = connection.prepareStatement("""
            select transaction_id, operation_key, subject, command_hash, woo_reference,
                   woo_order_id, items::text, amount, currency, status
              from transaction.checkout_operation where %s = ?
            """.formatted(column))) {
            statement.setString(1, identity);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) throw new IllegalStateException("checkout operation was not persisted");
                return operation(rows);
            }
        }
    }

    private Operation operation(ResultSet row) throws SQLException {
        var items = row.getString("items");
        return new Operation(
            row.getString("transaction_id"), row.getString("operation_key"), row.getString("subject"),
            row.getString("command_hash"), row.getString("woo_reference"), row.getString("woo_order_id"),
            items == null ? List.of() : readItems(items), row.getBigDecimal("amount"), row.getString("currency"),
            Status.valueOf(row.getString("status"))
        );
    }

    private void updateOwned(
        String assignment,
        String transactionId,
        String ownerToken,
        Instant now,
        Status expectedStatus,
        Object... values
    ) {
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(
            "update transaction.checkout_operation set " + assignment
                + " where transaction_id = ? and owner_token = cast(? as uuid)"
                + " and status = ? and lease_until > ?"
        )) {
            var index = 1;
            for (var value : values) statement.setObject(index++, value);
            statement.setString(index++, transactionId);
            statement.setString(index++, ownerToken);
            statement.setString(index++, expectedStatus.name());
            statement.setTimestamp(index, Timestamp.from(now));
            if (statement.executeUpdate() != 1) throw new IllegalStateException("checkout lease was lost");
        } catch (SQLException error) {
            throw new IllegalStateException("checkout operation could not be updated", error);
        }
    }

    private String writeItems(List<Transaction.Item> items) {
        try {
            return json.writeValueAsString(items);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("checkout items cannot be serialized", error);
        }
    }

    private List<Transaction.Item> readItems(String value) {
        try {
            return json.readValue(value, new TypeReference<List<Transaction.Item>>() {});
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("stored checkout items are invalid", error);
        }
    }

    private static void rollback(Connection connection, Exception original) {
        try {
            connection.rollback();
        } catch (SQLException rollbackError) {
            original.addSuppressed(rollbackError);
        }
    }
}
