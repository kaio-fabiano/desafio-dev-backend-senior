package dev.desafio.transaction.payment.adapter.persistence;

import dev.desafio.transaction.payment.application.PaymentProvider;
import dev.desafio.transaction.payment.application.PaymentRepository;
import dev.desafio.transaction.payment.domain.Payment;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public final class JdbcPaymentRepository implements PaymentRepository {
    private final DataSource dataSource;

    public JdbcPaymentRepository(DataSource dataSource) {
        this.dataSource = java.util.Objects.requireNonNull(dataSource, "dataSource");
    }

    @Override
    public String providerReference(Payment.RefundRequested command) {
        java.util.Objects.requireNonNull(command, "command");
        try (var connection = dataSource.getConnection()) {
            var payment = findPaymentForUpdate(connection, command.paymentId(), command.operationKey())
                .orElseThrow(() -> new IllegalStateException("authorized payment does not exist"));
            if (!payment.orderId().equals(command.orderId())
                || (payment.status() != Payment.Status.AUTHORIZED
                    && payment.status() != Payment.Status.REFUNDED)) {
                throw new IllegalStateException("authorized payment does not match the refund request");
            }
            return payment.providerReference();
        } catch (SQLException error) {
            throw new IllegalStateException("payment database is unavailable", error);
        }
    }

    @Override
    public ProcessingResult process(
        UUID incomingEventId,
        Payment.Command command,
        PaymentProvider.Result providerResult,
        Instant occurredAt
    ) {
        java.util.Objects.requireNonNull(incomingEventId, "incomingEventId");
        java.util.Objects.requireNonNull(command, "command");
        java.util.Objects.requireNonNull(providerResult, "providerResult");
        java.util.Objects.requireNonNull(occurredAt, "occurredAt");

        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                if (!claimInbox(connection, incomingEventId)) {
                    var duplicate = duplicateResult(connection, incomingEventId, command);
                    connection.commit();
                    return duplicate;
                }

                var payment = command instanceof Payment.PaymentRequested requested
                    ? processPaymentRequest(connection, requested, providerResult)
                    : processRefund(connection, (Payment.RefundRequested) command, providerResult);
                var event = Payment.resultEvent(payment, occurredAt);
                UUID effectId = null;
                if (event != null) {
                    effectId = ensureEffect(connection, payment, effectType(payment.status()), occurredAt);
                    insertOutbox(connection, effectId, event);
                    event = findOutbox(connection, effectId, payment)
                        .orElseThrow(() -> new IllegalStateException("payment outbox event was not persisted"));
                }
                completeInbox(connection, incomingEventId, payment.paymentId(), effectId,
                    event == null ? null : event.eventId());
                connection.commit();
                return new ProcessingResult(payment, event, false);
            } catch (RuntimeException | SQLException error) {
                rollback(connection, error);
                if (error instanceof RuntimeException runtime) throw runtime;
                throw new IllegalStateException("payment transaction failed", error);
            }
        } catch (SQLException error) {
            throw new IllegalStateException("payment database is unavailable", error);
        }
    }

    private Payment processPaymentRequest(
        Connection connection,
        Payment.PaymentRequested command,
        PaymentProvider.Result providerResult
    ) throws SQLException {
        var proposed = Payment.fromProvider(command, providerResult.toDomainResult());
        var stored = findPaymentForUpdate(connection, command.paymentId(), command.operationKey());
        if (stored.isEmpty()) {
            insertPayment(connection, proposed);
            return findPaymentForUpdate(connection, command.paymentId(), command.operationKey())
                .orElseThrow(() -> new IllegalStateException("payment was not persisted"));
        }
        var payment = stored.orElseThrow();
        if (!payment.hasSameIdentity(proposed)) {
            throw new IllegalArgumentException("operationKey and paymentId identify a different payment");
        }
        if (payment.status() == Payment.Status.PENDING && proposed.status() != Payment.Status.PENDING) {
            updatePayment(connection, proposed, Payment.Status.PENDING);
            return proposed;
        }
        return payment;
    }

    private Payment processRefund(
        Connection connection,
        Payment.RefundRequested command,
        PaymentProvider.Result providerResult
    ) throws SQLException {
        var stored = findPaymentForUpdate(connection, command.paymentId(), command.operationKey())
            .orElseThrow(() -> new IllegalStateException("authorized payment does not exist"));
        var refunded = stored.refund(command, providerResult.toDomainResult());
        if (stored.status() == Payment.Status.AUTHORIZED) {
            updatePayment(connection, refunded, Payment.Status.AUTHORIZED);
        }
        return refunded;
    }

    private ProcessingResult duplicateResult(
        Connection connection,
        UUID incomingEventId,
        Payment.Command command
    ) throws SQLException {
        var payment = findPaymentForUpdate(connection, command.paymentId(), command.operationKey())
            .orElseThrow(() -> new IllegalStateException("claimed payment inbox record is incomplete"));
        try (var statement = connection.prepareStatement("""
            select result_event_id from payment_inbox where event_id = ?
            """)) {
            statement.setObject(1, incomingEventId);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) throw new IllegalStateException("claimed payment inbox record is missing");
                var resultEventId = rows.getObject("result_event_id", UUID.class);
                var event = resultEventId == null
                    ? null
                    : findOutboxById(connection, resultEventId, payment)
                        .orElseThrow(() -> new IllegalStateException("claimed payment result is incomplete"));
                return new ProcessingResult(payment, event, true);
            }
        }
    }

    private Optional<Payment> findPaymentForUpdate(
        Connection connection,
        String paymentId,
        String operationKey
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            select payment_id, operation_key, order_id, method, amount, currency,
                   status, provider_reference, pix_code
              from payment_record
             where payment_id = ? or operation_key = ?
               for update
            """)) {
            statement.setString(1, paymentId);
            statement.setString(2, operationKey);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) return Optional.empty();
                var payment = readPayment(rows);
                if (rows.next()) {
                    throw new IllegalArgumentException("paymentId and operationKey identify different payments");
                }
                return Optional.of(payment);
            }
        }
    }

    private void insertPayment(Connection connection, Payment payment) throws SQLException {
        try (var statement = connection.prepareStatement("""
            insert into payment_record
                (payment_id, operation_key, order_id, method, amount, currency,
                 status, provider_reference, pix_code)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict do nothing
            """)) {
            bindPayment(statement, payment);
            statement.executeUpdate();
        }
    }

    private void updatePayment(
        Connection connection,
        Payment payment,
        Payment.Status expectedStatus
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            update payment_record
               set status = ?, provider_reference = ?, pix_code = ?, updated_at = current_timestamp
             where payment_id = ? and status = ?
            """)) {
            statement.setString(1, payment.status().name());
            statement.setString(2, payment.providerReference());
            statement.setString(3, payment.pixCode());
            statement.setString(4, payment.paymentId());
            statement.setString(5, expectedStatus.name());
            if (statement.executeUpdate() != 1) {
                throw new IllegalStateException("payment state changed while processing provider result");
            }
        }
    }

    private void bindPayment(java.sql.PreparedStatement statement, Payment payment) throws SQLException {
        statement.setString(1, payment.paymentId());
        statement.setString(2, payment.operationKey());
        statement.setString(3, payment.orderId());
        statement.setString(4, payment.method().name());
        statement.setBigDecimal(5, payment.amount());
        statement.setString(6, payment.currency());
        statement.setString(7, payment.status().name());
        statement.setString(8, payment.providerReference());
        statement.setString(9, payment.pixCode());
    }

    private UUID ensureEffect(
        Connection connection,
        Payment payment,
        String effectType,
        Instant occurredAt
    ) throws SQLException {
        var proposedId = Payment.stableUuid(payment.operationKey(), payment.paymentId(), effectType);
        try (var statement = connection.prepareStatement("""
            insert into payment_effect (effect_id, payment_id, operation_key, effect_type, occurred_at)
            values (?, ?, ?, ?, ?)
            on conflict do nothing
            """)) {
            statement.setObject(1, proposedId);
            statement.setString(2, payment.paymentId());
            statement.setString(3, payment.operationKey());
            statement.setString(4, effectType);
            statement.setTimestamp(5, Timestamp.from(occurredAt));
            statement.executeUpdate();
        }
        return proposedId;
    }

    private void insertOutbox(
        Connection connection,
        UUID effectId,
        Payment.OutgoingEvent event
    ) throws SQLException {
        var sql = switch (event.eventType()) {
            case "payment.authorized" -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, ?, jsonb_build_object(
                    'paymentId', ?, 'orderId', ?, 'providerReference', ?
                ), ?)
                on conflict do nothing
                """;
            case "payment.pix-generated" -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, ?, jsonb_build_object(
                    'paymentId', ?, 'orderId', ?, 'providerReference', ?, 'pixCode', ?
                ), ?)
                on conflict do nothing
                """;
            case "payment.failed" -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, ?, jsonb_build_object('paymentId', ?, 'reason', ?), ?)
                on conflict do nothing
                """;
            default -> """
                insert into payment_outbox
                    (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                values (?, ?, ?, ?, ?, jsonb_build_object('paymentId', ?, 'orderId', ?), ?)
                on conflict do nothing
                """;
        };
        try (var statement = connection.prepareStatement(sql)) {
            statement.setObject(1, event.eventId());
            statement.setObject(2, effectId);
            statement.setString(3, event.operationKey());
            statement.setString(4, event.eventType());
            statement.setString(5, event.eventVersion());
            var index = 6;
            for (var value : event.payload().values()) statement.setString(index++, value);
            statement.setTimestamp(index, Timestamp.from(event.occurredAt()));
            statement.executeUpdate();
        }
    }

    private Optional<Payment.OutgoingEvent> findOutbox(
        Connection connection,
        UUID effectId,
        Payment payment
    ) throws SQLException {
        return findOutbox(connection, "effect_id", effectId, payment);
    }

    private Optional<Payment.OutgoingEvent> findOutboxById(
        Connection connection,
        UUID eventId,
        Payment payment
    ) throws SQLException {
        return findOutbox(connection, "event_id", eventId, payment);
    }

    private Optional<Payment.OutgoingEvent> findOutbox(
        Connection connection,
        String column,
        UUID value,
        Payment payment
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            select event_id, event_type, event_version, operation_key, occurred_at
              from payment_outbox
             where """ + column + " = ?")) {
            statement.setObject(1, value);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) return Optional.empty();
                var status = switch (rows.getString("event_type")) {
                    case "payment.authorized" -> Payment.Status.AUTHORIZED;
                    case "payment.pix-generated" -> Payment.Status.PIX_GENERATED;
                    case "payment.refunded" -> Payment.Status.REFUNDED;
                    case "payment.failed" -> Payment.Status.REJECTED;
                    default -> throw new IllegalStateException("unsupported payment outbox event");
                };
                var stored = Payment.resultEvent(payment, status, rows.getTimestamp("occurred_at").toInstant());
                return Optional.of(new Payment.OutgoingEvent(
                    rows.getObject("event_id", UUID.class),
                    rows.getString("event_type"),
                    rows.getString("event_version"),
                    rows.getString("operation_key"),
                    stored.occurredAt(),
                    stored.payload()
                ));
            }
        }
    }

    private boolean claimInbox(Connection connection, UUID incomingEventId) throws SQLException {
        try (var statement = connection.prepareStatement("""
            insert into payment_inbox (event_id) values (?)
            on conflict (event_id) do nothing
            """)) {
            statement.setObject(1, incomingEventId);
            return statement.executeUpdate() == 1;
        }
    }

    private void completeInbox(
        Connection connection,
        UUID incomingEventId,
        String paymentId,
        UUID effectId,
        UUID resultEventId
    ) throws SQLException {
        try (var statement = connection.prepareStatement("""
            update payment_inbox
               set payment_id = ?, effect_id = ?, result_event_id = ?
             where event_id = ?
            """)) {
            statement.setString(1, paymentId);
            statement.setObject(2, effectId);
            statement.setObject(3, resultEventId);
            statement.setObject(4, incomingEventId);
            if (statement.executeUpdate() != 1) {
                throw new IllegalStateException("payment inbox record was not completed");
            }
        }
    }

    private Payment readPayment(ResultSet row) throws SQLException {
        return new Payment(
            row.getString("payment_id"),
            row.getString("operation_key"),
            row.getString("order_id"),
            Payment.Method.valueOf(row.getString("method")),
            row.getBigDecimal("amount"),
            row.getString("currency"),
            Payment.Status.valueOf(row.getString("status")),
            row.getString("provider_reference"),
            row.getString("pix_code")
        );
    }

    private String effectType(Payment.Status status) {
        return switch (status) {
            case AUTHORIZED -> "CARD_AUTHORIZATION";
            case PIX_GENERATED -> "PIX_CODE_GENERATION";
            case REFUNDED -> "REFUND";
            case REJECTED -> "PAYMENT_REJECTION";
            case PENDING -> throw new IllegalArgumentException("pending payments have no effect");
        };
    }

    private void rollback(Connection connection, Exception cause) {
        try {
            connection.rollback();
        } catch (SQLException rollbackError) {
            cause.addSuppressed(rollbackError);
        }
    }
}
