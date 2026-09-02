package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.ProviderNotificationHandler;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class JdbcProviderNotificationRepository implements ProviderNotificationHandler.Repository {
    private final DataSource dataSource;

    public JdbcProviderNotificationRepository(DataSource dataSource) {
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
    }

    @Override
    public ProviderNotificationHandler.Outcome apply(
        String providerRequestId,
        PaymentProvider.Result authoritativeState,
        Instant receivedAt
    ) {
        Objects.requireNonNull(authoritativeState, "authoritativeState");
        Objects.requireNonNull(receivedAt, "receivedAt");

        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                if (!claimNotification(connection, providerRequestId, authoritativeState, receivedAt)) {
                    connection.commit();
                    return ProviderNotificationHandler.Outcome.DUPLICATE;
                }

                var payment = findPaymentForUpdate(connection, authoritativeState.providerReference());
                var targetStatus = authoritativeState.status().name();
                ProviderNotificationHandler.Outcome outcome;
                if (payment.currentStatus().equals(targetStatus)) {
                    outcome = ProviderNotificationHandler.Outcome.NO_CHANGE;
                } else if (!isMonotonicTransition(payment, targetStatus)) {
                    outcome = ProviderNotificationHandler.Outcome.IGNORED;
                } else {
                    updatePayment(connection, payment, authoritativeState);
                    insertOutbox(connection, payment, authoritativeState, receivedAt);
                    outcome = ProviderNotificationHandler.Outcome.APPLIED;
                }

                completeNotification(connection, providerRequestId, outcome, receivedAt);
                connection.commit();
                return outcome;
            } catch (RuntimeException | SQLException error) {
                rollback(connection, error);
                if (error instanceof RuntimeException runtime) throw runtime;
                throw new IllegalStateException("provider notification transaction failed", error);
            }
        } catch (SQLException error) {
            throw new IllegalStateException("payment database is unavailable", error);
        }
    }

    private boolean claimNotification(
        Connection connection,
        String providerRequestId,
        PaymentProvider.Result authoritativeState,
        Instant receivedAt
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            insert into provider_notification_inbox
                (provider_request_id, provider_reference, authoritative_status, received_at)
            values (?, ?, ?, ?)
            on conflict (provider_request_id) do nothing
            """)) {
            statement.setString(1, requireText(providerRequestId, "providerRequestId"));
            statement.setString(2, authoritativeState.providerReference());
            statement.setString(3, authoritativeState.status().name());
            statement.setTimestamp(4, Timestamp.from(receivedAt));
            return statement.executeUpdate() == 1;
        }
    }

    private StoredPayment findPaymentForUpdate(Connection connection, String providerReference)
        throws SQLException {
        try (var statement = connection.prepareStatement("""
            select payment_id, operation_key, order_id, method, status, provider_reference
              from payment_record
             where provider_reference = ?
               for update
            """)) {
            statement.setString(1, providerReference);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) {
                    throw new IllegalStateException("provider notification does not match a stored payment");
                }
                var payment = readPayment(rows);
                if (rows.next()) {
                    throw new IllegalStateException("provider reference matches more than one payment");
                }
                return payment;
            }
        }
    }

    private StoredPayment readPayment(ResultSet row) throws SQLException {
        return new StoredPayment(
            row.getString("payment_id"),
            row.getString("operation_key"),
            row.getString("order_id"),
            row.getString("method"),
            row.getString("status"),
            row.getString("provider_reference")
        );
    }

    private boolean isMonotonicTransition(StoredPayment payment, String targetStatus) {
        var currentStatus = payment.currentStatus();
        if ("PENDING".equals(currentStatus)) {
            return switch (payment.method()) {
                case "CARD" -> "AUTHORIZED".equals(targetStatus) || "REJECTED".equals(targetStatus);
                case "PIX" -> "PIX_GENERATED".equals(targetStatus) || "REJECTED".equals(targetStatus);
                default -> false;
            };
        }
        return "AUTHORIZED".equals(currentStatus) && "REFUNDED".equals(targetStatus);
    }

    private void updatePayment(
        Connection connection,
        StoredPayment payment,
        PaymentProvider.Result authoritativeState
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            update payment_record
               set status = ?, pix_code = ?, updated_at = current_timestamp
             where payment_id = ? and status = ? and provider_reference = ?
            """)) {
            statement.setString(1, authoritativeState.status().name());
            statement.setString(2, authoritativeState.pixCode());
            statement.setString(3, payment.paymentId());
            statement.setString(4, payment.currentStatus());
            statement.setString(5, payment.providerReference());
            if (statement.executeUpdate() != 1) {
                throw new IllegalStateException("payment state changed while processing provider notification");
            }
        }
    }

    private void insertOutbox(
        Connection connection,
        StoredPayment payment,
        PaymentProvider.Result authoritativeState,
        Instant occurredAt
    ) throws SQLException {
        var eventType = eventType(authoritativeState.status().name());
        var effectType = effectType(authoritativeState.status().name());
        var effectId = stableUuid(payment.operationKey(), payment.paymentId(), effectType);
        var eventId = stableUuid(payment.operationKey(), payment.paymentId(), eventType);

        try (var statement = connection.prepareStatement("""
            insert into payment_effect (effect_id, payment_id, operation_key, effect_type, occurred_at)
            values (?, ?, ?, ?, ?)
            on conflict do nothing
            """)) {
            statement.setObject(1, effectId);
            statement.setString(2, payment.paymentId());
            statement.setString(3, payment.operationKey());
            statement.setString(4, effectType);
            statement.setTimestamp(5, Timestamp.from(occurredAt));
            statement.executeUpdate();
        }

        var sql = switch (eventType) {
            case "payment.authorized" -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, 'v1', jsonb_build_object(
                    'paymentId', ?, 'orderId', ?, 'providerReference', ?
                ), ?)
                on conflict (operation_key, event_type) do nothing
                """;
            case "payment.pix-generated" -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, 'v1', jsonb_build_object(
                    'paymentId', ?, 'orderId', ?, 'providerReference', ?, 'pixCode', ?
                ), ?)
                on conflict (operation_key, event_type) do nothing
                """;
            case "payment.failed" -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, 'v1', jsonb_build_object(
                    'paymentId', ?, 'reason', 'PROVIDER_REJECTED'
                ), ?)
                on conflict (operation_key, event_type) do nothing
                """;
            default -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, 'v1', jsonb_build_object(
                    'paymentId', ?, 'orderId', ?
                ), ?)
                on conflict (operation_key, event_type) do nothing
                """;
        };
        try (var statement = connection.prepareStatement(sql)) {
            statement.setObject(1, eventId);
            statement.setObject(2, effectId);
            statement.setString(3, payment.operationKey());
            statement.setString(4, eventType);
            statement.setString(5, payment.paymentId());
            var index = 6;
            if (!"payment.failed".equals(eventType)) {
                statement.setString(index++, payment.orderId());
            }
            if ("payment.authorized".equals(eventType) || "payment.pix-generated".equals(eventType)) {
                statement.setString(index++, payment.providerReference());
            }
            if ("payment.pix-generated".equals(eventType)) {
                statement.setString(index++, authoritativeState.pixCode());
            }
            statement.setTimestamp(index, Timestamp.from(occurredAt));
            statement.executeUpdate();
        }
    }

    private String eventType(String status) {
        return switch (status) {
            case "AUTHORIZED" -> "payment.authorized";
            case "PIX_GENERATED" -> "payment.pix-generated";
            case "REFUNDED" -> "payment.refunded";
            case "REJECTED" -> "payment.failed";
            default -> throw new IllegalArgumentException("status does not produce a payment event");
        };
    }

    private String effectType(String status) {
        return switch (status) {
            case "AUTHORIZED" -> "CARD_AUTHORIZATION";
            case "PIX_GENERATED" -> "PIX_CODE_GENERATION";
            case "REFUNDED" -> "REFUND";
            case "REJECTED" -> "PAYMENT_REJECTION";
            default -> throw new IllegalArgumentException("status does not produce a payment effect");
        };
    }

    private void completeNotification(
        Connection connection,
        String providerRequestId,
        ProviderNotificationHandler.Outcome outcome,
        Instant processedAt
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            update provider_notification_inbox
               set processing_outcome = ?, processed_at = ?
             where provider_request_id = ?
            """)) {
            statement.setString(1, outcome.name());
            statement.setTimestamp(2, Timestamp.from(processedAt));
            statement.setString(3, providerRequestId);
            if (statement.executeUpdate() != 1) {
                throw new IllegalStateException("provider notification inbox record was not completed");
            }
        }
    }

    private UUID stableUuid(String operationKey, String paymentId, String discriminator) {
        var material = operationKey.length() + ":" + operationKey
            + paymentId.length() + ":" + paymentId
            + discriminator.length() + ":" + discriminator;
        return UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8));
    }

    private String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
        return value;
    }

    private void rollback(Connection connection, Exception cause) {
        try {
            connection.rollback();
        } catch (SQLException rollbackError) {
            cause.addSuppressed(rollbackError);
        }
    }

    private record StoredPayment(
        String paymentId,
        String operationKey,
        String orderId,
        String method,
        String currentStatus,
        String providerReference
    ) {}
}
