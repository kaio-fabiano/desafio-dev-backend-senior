package dev.desafio.payment.adapter.persistence;

import dev.desafio.payment.domain.Payment;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository {
    ProcessingResult process(UUID incomingEventId, Payment.Command command, Instant occurredAt);

    record ProcessingResult(Payment payment, Payment.OutgoingEvent outgoingEvent, boolean duplicateDelivery) {
        public ProcessingResult {
            Objects.requireNonNull(payment, "payment");
            Objects.requireNonNull(outgoingEvent, "outgoingEvent");
        }
    }

    final class Jdbc implements PaymentRepository {
        private final DataSource dataSource;

        public Jdbc(DataSource dataSource) {
            this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
        }

        @Override
        public ProcessingResult process(UUID incomingEventId, Payment.Command command, Instant occurredAt) {
            Objects.requireNonNull(incomingEventId, "incomingEventId");
            Objects.requireNonNull(command, "command");
            Objects.requireNonNull(occurredAt, "occurredAt");

            try (var connection = dataSource.getConnection()) {
                connection.setAutoCommit(false);
                try {
                    var effectType = effectType(command);
                    var resultEventType = resultEventType(command);
                    var proposedEffectId = stableUuid(command.operationKey(), command.paymentId(), effectType);
                    var proposedResultEventId = stableUuid(command.operationKey(), command.paymentId(), resultEventType);
                    if (!claimInbox(connection, incomingEventId, proposedEffectId, proposedResultEventId)) {
                        var duplicate = findInboxResult(connection, incomingEventId)
                            .orElseThrow(() -> new IllegalStateException("claimed payment inbox record is incomplete"));
                        connection.commit();
                        return duplicate;
                    }

                    var processed = command instanceof Payment.PaymentRequested requested
                        ? processPaymentRequest(connection, requested, occurredAt)
                        : processRefund(connection, (Payment.RefundRequested) command, occurredAt);

                    insertOutbox(connection, processed.effectId(), processed.outgoingEvent());
                    var storedEvent = findOutbox(connection, processed.effectId(), processed.payment())
                        .orElseThrow(() -> new IllegalStateException("payment outbox event was not persisted"));
                    if (!processed.effectId().equals(proposedEffectId)
                        || !storedEvent.eventId().equals(proposedResultEventId)) {
                        throw new IllegalStateException("payment idempotency key resolved to a conflicting effect");
                    }

                    connection.commit();
                    return new ProcessingResult(processed.payment(), storedEvent, false);
                } catch (RuntimeException | SQLException error) {
                    rollback(connection, error);
                    if (error instanceof RuntimeException runtime) throw runtime;
                    throw new IllegalStateException("payment transaction failed", error);
                }
            } catch (SQLException error) {
                throw new IllegalStateException("payment database is unavailable", error);
            }
        }

        private StoredProcessing processPaymentRequest(
            Connection connection,
            Payment.PaymentRequested command,
            Instant occurredAt
        ) throws SQLException {
            var requested = Payment.start(command);
            var stored = findPaymentForUpdate(connection, command.paymentId(), command.operationKey());
            if (stored.isEmpty()) {
                insertPayment(connection, requested);
                stored = findPaymentForUpdate(connection, command.paymentId(), command.operationKey());
            }
            var payment = stored.orElseThrow(() -> new IllegalStateException("payment effect was not persisted"));
            if (!payment.hasSameIdentity(requested)) {
                throw new IllegalArgumentException("operationKey and paymentId identify a different payment");
            }

            var resultStatus = command.method() == Payment.Method.CARD
                ? Payment.Status.AUTHORIZED
                : Payment.Status.PIX_GENERATED;
            var effectType = command.method() == Payment.Method.CARD ? "CARD_AUTHORIZATION" : "PIX_CODE_GENERATION";
            var effectId = ensureEffect(connection, payment, effectType, occurredAt);
            return new StoredProcessing(
                effectId, payment, Payment.resultEvent(payment, resultStatus, occurredAt)
            );
        }

        private StoredProcessing processRefund(
            Connection connection,
            Payment.RefundRequested command,
            Instant occurredAt
        ) throws SQLException {
            var stored = findPaymentForUpdate(connection, command.paymentId(), command.operationKey())
                .orElseThrow(() -> new IllegalStateException("authorized payment does not exist"));
            var refunded = stored.refund(command);
            if (stored.status() == Payment.Status.AUTHORIZED) updatePaymentStatus(connection, stored.paymentId());
            var effectId = ensureEffect(connection, refunded, "REFUND", occurredAt);
            return new StoredProcessing(
                effectId, refunded, Payment.resultEvent(refunded, Payment.Status.REFUNDED, occurredAt)
            );
        }

        private Optional<ProcessingResult> findInboxResult(Connection connection, UUID eventId) throws SQLException {
            try (var statement = connection.prepareStatement("""
                select p.payment_id, p.operation_key, p.order_id, p.method, p.amount, p.currency,
                       p.status, p.pix_code, o.event_id as result_event_id, o.event_type,
                       o.event_version, o.occurred_at
                  from payment_inbox i
                  join payment_effect e on e.effect_id = i.effect_id
                  join payment_record p on p.payment_id = e.payment_id
                  join payment_outbox o on o.event_id = i.result_event_id
                 where i.event_id = ?
                """)) {
                statement.setObject(1, eventId);
                try (var rows = statement.executeQuery()) {
                    if (!rows.next()) return Optional.empty();
                    var payment = readPayment(rows);
                    return Optional.of(new ProcessingResult(payment, readEvent(rows, payment), true));
                }
            }
        }

        private Optional<Payment> findPaymentForUpdate(
            Connection connection,
            String paymentId,
            String operationKey
        ) throws SQLException {
            try (var statement = connection.prepareStatement("""
                select payment_id, operation_key, order_id, method, amount, currency, status, pix_code
                  from payment_record
                 where payment_id = ? or operation_key = ?
                   for update
                """)) {
                statement.setString(1, paymentId);
                statement.setString(2, operationKey);
                try (var rows = statement.executeQuery()) {
                    if (!rows.next()) return Optional.empty();
                    var payment = readPayment(rows);
                    if (rows.next()) throw new IllegalArgumentException("paymentId and operationKey identify different payments");
                    return Optional.of(payment);
                }
            }
        }

        private void insertPayment(Connection connection, Payment payment) throws SQLException {
            try (var statement = connection.prepareStatement("""
                insert into payment_record
                    (payment_id, operation_key, order_id, method, amount, currency, status, pix_code)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                on conflict do nothing
                """)) {
                statement.setString(1, payment.paymentId());
                statement.setString(2, payment.operationKey());
                statement.setString(3, payment.orderId());
                statement.setString(4, payment.method().name());
                statement.setBigDecimal(5, payment.amount());
                statement.setString(6, payment.currency());
                statement.setString(7, payment.status().name());
                statement.setString(8, payment.pixCode());
                statement.executeUpdate();
            }
        }

        private void updatePaymentStatus(Connection connection, String paymentId) throws SQLException {
            try (var statement = connection.prepareStatement("""
                update payment_record
                   set status = 'REFUNDED', updated_at = current_timestamp
                 where payment_id = ? and status = 'AUTHORIZED'
                """)) {
                statement.setString(1, paymentId);
                if (statement.executeUpdate() != 1) {
                    throw new IllegalStateException("authorized payment could not be refunded");
                }
            }
        }

        private UUID ensureEffect(
            Connection connection,
            Payment payment,
            String effectType,
            Instant occurredAt
        ) throws SQLException {
            var proposedId = stableUuid(payment.operationKey(), payment.paymentId(), effectType);
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
            try (var statement = connection.prepareStatement("""
                select effect_id from payment_effect where payment_id = ? and effect_type = ?
                """)) {
                statement.setString(1, payment.paymentId());
                statement.setString(2, effectType);
                try (var rows = statement.executeQuery()) {
                    if (!rows.next()) throw new IllegalStateException("payment effect was not persisted");
                    return rows.getObject("effect_id", UUID.class);
                }
            }
        }

        private void insertOutbox(
            Connection connection,
            UUID effectId,
            Payment.OutgoingEvent event
        ) throws SQLException {
            var pix = "payment.pix-generated".equals(event.eventType());
            var sql = pix
                ? """
                    insert into payment_outbox
                        (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                    values (?, ?, ?, ?, ?, jsonb_build_object('paymentId', ?, 'orderId', ?, 'pixCode', ?), ?)
                    on conflict do nothing
                    """
                : """
                    insert into payment_outbox
                        (event_id, effect_id, operation_key, event_type, event_version, payload, occurred_at)
                    values (?, ?, ?, ?, ?, jsonb_build_object('paymentId', ?, 'orderId', ?), ?)
                    on conflict do nothing
                    """;
            try (var statement = connection.prepareStatement(sql)) {
                statement.setObject(1, event.eventId());
                statement.setObject(2, effectId);
                statement.setString(3, event.operationKey());
                statement.setString(4, event.eventType());
                statement.setString(5, event.eventVersion());
                statement.setString(6, event.payload().get("paymentId"));
                statement.setString(7, event.payload().get("orderId"));
                if (pix) statement.setString(8, event.payload().get("pixCode"));
                statement.setTimestamp(pix ? 9 : 8, Timestamp.from(event.occurredAt()));
                statement.executeUpdate();
            }
        }

        private Optional<Payment.OutgoingEvent> findOutbox(
            Connection connection,
            UUID effectId,
            Payment payment
        ) throws SQLException {
            try (var statement = connection.prepareStatement("""
                select event_id as result_event_id, event_type, event_version, operation_key, occurred_at
                  from payment_outbox
                 where effect_id = ?
                """)) {
                statement.setObject(1, effectId);
                try (var rows = statement.executeQuery()) {
                    return rows.next() ? Optional.of(readEvent(rows, payment)) : Optional.empty();
                }
            }
        }

        private boolean claimInbox(
            Connection connection,
            UUID incomingEventId,
            UUID effectId,
            UUID resultEventId
        ) throws SQLException {
            try (var statement = connection.prepareStatement("""
                insert into payment_inbox (event_id, effect_id, result_event_id)
                values (?, ?, ?)
                on conflict (event_id) do nothing
                """)) {
                statement.setObject(1, incomingEventId);
                statement.setObject(2, effectId);
                statement.setObject(3, resultEventId);
                return statement.executeUpdate() == 1;
            }
        }

        private String effectType(Payment.Command command) {
            if (command instanceof Payment.RefundRequested) return "REFUND";
            return ((Payment.PaymentRequested) command).method() == Payment.Method.CARD
                ? "CARD_AUTHORIZATION"
                : "PIX_CODE_GENERATION";
        }

        private String resultEventType(Payment.Command command) {
            if (command instanceof Payment.RefundRequested) return "payment.refunded";
            return ((Payment.PaymentRequested) command).method() == Payment.Method.CARD
                ? "payment.authorized"
                : "payment.pix-generated";
        }

        private Payment readPayment(ResultSet row) throws SQLException {
            return new Payment(
                row.getString("payment_id"), row.getString("operation_key"), row.getString("order_id"),
                Payment.Method.valueOf(row.getString("method")), row.getBigDecimal("amount"),
                row.getString("currency"), Payment.Status.valueOf(row.getString("status")),
                row.getString("pix_code")
            );
        }

        private Payment.OutgoingEvent readEvent(ResultSet row, Payment payment) throws SQLException {
            var eventType = row.getString("event_type");
            var status = switch (eventType) {
                case "payment.authorized" -> Payment.Status.AUTHORIZED;
                case "payment.pix-generated" -> Payment.Status.PIX_GENERATED;
                case "payment.refunded" -> Payment.Status.REFUNDED;
                default -> throw new IllegalStateException("unsupported payment outbox event: " + eventType);
            };
            var stored = Payment.resultEvent(payment, status, row.getTimestamp("occurred_at").toInstant());
            return new Payment.OutgoingEvent(
                row.getObject("result_event_id", UUID.class), eventType, row.getString("event_version"),
                row.getString("operation_key"), stored.occurredAt(), stored.payload()
            );
        }

        private UUID stableUuid(String operationKey, String paymentId, String effectType) {
            return UUID.nameUUIDFromBytes(
                (operationKey.length() + ":" + operationKey
                    + paymentId.length() + ":" + paymentId
                    + effectType.length() + ":" + effectType).getBytes(StandardCharsets.UTF_8)
            );
        }

        private void rollback(Connection connection, Exception cause) {
            try {
                connection.rollback();
            } catch (SQLException rollbackError) {
                cause.addSuppressed(rollbackError);
            }
        }

        private record StoredProcessing(
            UUID effectId,
            Payment payment,
            Payment.OutgoingEvent outgoingEvent
        ) {}
    }
}
