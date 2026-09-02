package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.domain.Inventory;

import java.util.Objects;
import java.util.UUID;

public interface InventoryRepository {
    Claim claim(Inventory.ReservationRequested request, String requestFingerprint);

    Inventory.OutgoingEvent complete(Claim claim, Inventory.OutgoingEvent event);

    enum ClaimStatus { ACQUIRED, BUSY, COMPLETED }

    record Claim(
        ClaimStatus status,
        UUID incomingEventId,
        String operationKey,
        UUID ownerToken,
        Inventory.OutgoingEvent completedEvent
    ) {
        public Claim {
            Objects.requireNonNull(status, "status");
            Objects.requireNonNull(incomingEventId, "incomingEventId");
            Objects.requireNonNull(operationKey, "operationKey");
            if (status == ClaimStatus.ACQUIRED && ownerToken == null) {
                throw new IllegalArgumentException("an acquired inventory claim requires an owner token");
            }
            if (status == ClaimStatus.COMPLETED && completedEvent == null) {
                throw new IllegalArgumentException("a completed inventory claim requires its event");
            }
        }
    }
}
