package dev.desafio.transaction.contracts;

import dev.desafio.transaction.contracts.integration.v1.IntegrationEventEnvelope;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IntegrationEventEnvelopeContractTest {
    @Test
    @DisplayName("V1 contracts remain typed and reject missing causal metadata @spec:AC-280")
    void v1ContractsRemainTypedAndRejectMissingCausalMetadata() {
        var event = new IntegrationEventEnvelope<>(
            UUID.randomUUID(),
            "transaction.order-received.v1",
            1,
            "transaction-245",
            "transaction-245",
            "correlation-245",
            "command-245",
            Instant.parse("2026-09-09T12:00:00Z"),
            new OrderReceived("order-245")
        );

        assertEquals("order-245", event.payload().orderId());
        assertThrows(IllegalArgumentException.class, () -> new IntegrationEventEnvelope<>(
            event.eventId(),
            event.eventType(),
            event.version(),
            event.aggregateId(),
            event.transactionId(),
            event.correlationId(),
            " ",
            event.occurredAt(),
            event.payload()
        ));
    }

    private record OrderReceived(String orderId) {}
}
