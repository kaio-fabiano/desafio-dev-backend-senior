package dev.desafio.transaction.inventory.application;

import dev.desafio.transaction.inventory.domain.Inventory;
import dev.desafio.transaction.inventory.domain.InventoryErrorMessages;

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
            Objects.requireNonNull(status, InventoryErrorMessages.STATUS);
            Objects.requireNonNull(incomingEventId, InventoryErrorMessages.INCOMING_EVENT_ID);
            Objects.requireNonNull(operationKey, InventoryErrorMessages.OPERATION_KEY);
            if (status == ClaimStatus.ACQUIRED && ownerToken == null) {
                throw new IllegalArgumentException(InventoryErrorMessages.OWNER_TOKEN_REQUIRED);
            }
            if (status == ClaimStatus.COMPLETED && completedEvent == null) {
                throw new IllegalArgumentException(InventoryErrorMessages.COMPLETED_CLAIM_REQUIRES_EVENT);
            }
        }
    }
}
