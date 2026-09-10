package dev.desafio.transaction.inventory.adapter.persistence;

import dev.desafio.transaction.inventory.application.InventoryRepository;
import dev.desafio.transaction.inventory.domain.Inventory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.util.Objects;
import java.util.UUID;

public final class JpaInventoryRepository implements InventoryRepository {
    private static final Duration LEASE = Duration.ofSeconds(60);

    private final InventoryOperationJpaRepository operations;
    private final InventoryResultEventJpaRepository results;
    private final InventoryInboxJpaRepository inbox;
    private final TransactionTemplate transactions;
    private final Clock clock;

    public JpaInventoryRepository(
        InventoryOperationJpaRepository operations,
        InventoryResultEventJpaRepository results,
        InventoryInboxJpaRepository inbox,
        PlatformTransactionManager transactionManager,
        Clock clock
    ) {
        this.operations = operations;
        this.results = results;
        this.inbox = inbox;
        transactions = new TransactionTemplate(transactionManager);
        transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clock;
    }

    @Override
    public Claim claim(Inventory.ReservationRequested request, String requestFingerprint) {
        Objects.requireNonNull(request, "request");
        if (requestFingerprint == null || requestFingerprint.isBlank()) {
            throw new IllegalArgumentException("requestFingerprint is required");
        }
        var ownerToken = UUID.randomUUID();
        var inserted = insertClaim(request, requestFingerprint, ownerToken);
        return transactions.execute(ignored -> readOrReclaim(
            request, requestFingerprint, ownerToken, inserted
        ));
    }

    @Override
    public Inventory.OutgoingEvent complete(Claim claim, Inventory.OutgoingEvent event) {
        Objects.requireNonNull(claim, "claim");
        Objects.requireNonNull(event, "event");
        if (claim.status() != ClaimStatus.ACQUIRED || !claim.operationKey().equals(event.operationKey())) {
            throw new IllegalArgumentException("only the acquired inventory claim can be completed");
        }
        return transactions.execute(ignored -> {
            var operation = operations.lockByOperationKey(claim.operationKey())
                .orElseThrow(() -> new IllegalStateException("inventory claim was not persisted"));
            if (operation.state() != InventoryOperationEntity.State.CLAIMED
                || !claim.ownerToken().equals(operation.ownerToken())) {
                throw new IllegalStateException("inventory claim ownership was lost before completion");
            }
            var stored = results.findByOperationKey(event.operationKey()).orElseGet(() ->
                results.saveAndFlush(InventoryResultEventMapper.toEntity(event))
            );
            operation.complete(stored.eventId(), clock.instant());
            operations.save(operation);
            recordInbox(claim.incomingEventId(), stored.eventId());
            return InventoryResultEventMapper.toDomain(stored);
        });
    }

    private boolean insertClaim(
        Inventory.ReservationRequested request,
        String fingerprint,
        UUID ownerToken
    ) {
        try {
            return Boolean.TRUE.equals(transactions.execute(ignored -> {
                if (operations.existsById(request.operationKey())) return false;
                var now = clock.instant();
                operations.saveAndFlush(new InventoryOperationEntity(
                    request.operationKey(), request.orderId(), fingerprint, ownerToken,
                    now.plus(LEASE), now
                ));
                return true;
            }));
        } catch (DataIntegrityViolationException duplicateClaim) {
            return false;
        }
    }

    private Claim readOrReclaim(
        Inventory.ReservationRequested request,
        String fingerprint,
        UUID ownerToken,
        boolean inserted
    ) {
        var operation = operations.lockByOperationKey(request.operationKey())
            .orElseThrow(() -> new IllegalStateException("inventory claim was not persisted"));
        if (!request.orderId().equals(operation.orderId())
            || !fingerprint.equals(operation.requestFingerprint())) {
            throw new IllegalArgumentException("operationKey identifies a different inventory request");
        }
        if (operation.state() == InventoryOperationEntity.State.COMPLETED) {
            var result = results.findById(operation.resultEventId())
                .orElseThrow(() -> new IllegalStateException("inventory result was not persisted"));
            recordInbox(request.eventId(), result.eventId());
            return new Claim(
                ClaimStatus.COMPLETED, request.eventId(), request.operationKey(), null,
                InventoryResultEventMapper.toDomain(result)
            );
        }
        var now = clock.instant();
        if (!inserted && !operation.leaseUntil().isAfter(now)) {
            operation.reclaim(ownerToken, now.plus(LEASE), now);
            operations.save(operation);
            inserted = true;
        }
        var acquired = inserted && ownerToken.equals(operation.ownerToken());
        return new Claim(
            acquired ? ClaimStatus.ACQUIRED : ClaimStatus.BUSY,
            request.eventId(), request.operationKey(), acquired ? ownerToken : null, null
        );
    }

    private void recordInbox(UUID incomingEventId, UUID resultEventId) {
        if (!inbox.existsById(incomingEventId)) {
            inbox.save(new InventoryInboxEntity(incomingEventId, resultEventId));
        }
    }
}
