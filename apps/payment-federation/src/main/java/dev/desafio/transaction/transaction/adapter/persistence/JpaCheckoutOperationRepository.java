package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.checkout.CheckoutIdempotencyConflictException;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class JpaCheckoutOperationRepository implements CheckoutOperationRepository {
    private final CheckoutOperationJpaRepository records;
    private final EntityManager entityManager;
    private final TransactionTemplate transaction;

    public JpaCheckoutOperationRepository(
        CheckoutOperationJpaRepository records,
        EntityManager entityManager,
        PlatformTransactionManager transactionManager
    ) {
        this.records = records;
        this.entityManager = entityManager;
        transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public Claim claim(ClaimRequest request, Instant now, Duration lease) {
        Objects.requireNonNull(request, "request");
        Objects.requireNonNull(now, "now");
        Objects.requireNonNull(lease, "lease");
        if (lease.isNegative() || lease.isZero()) throw new IllegalArgumentException("lease must be positive");
        try {
            return transaction.execute(ignored -> claimOnce(request, now, lease));
        } catch (DataIntegrityViolationException collision) {
            return transaction.execute(ignored -> records.findByOperationKey(request.operationKey())
                .map(entity -> claimExisting(entity, request, now, lease))
                .orElseThrow(() -> records.findByWooReference(request.wooReference()).isPresent()
                    ? new CheckoutIdempotencyConflictException()
                    : collision));
        }
    }

    @Override
    public void beginWooCreation(String transactionId, String ownerToken, Instant now) {
        var token = UUID.fromString(ownerToken);
        transaction.executeWithoutResult(ignored -> {
            var entity = owned(transactionId, token, now, Status.PENDING_WOO);
            entity.beginWooCreation(now);
            records.saveAndFlush(entity);
        });
    }

    @Override
    public Operation recordWooOrder(
        String transactionId,
        String ownerToken,
        WooCommerceOrderPort.Order order,
        Instant now
    ) {
        var token = UUID.fromString(ownerToken);
        return transaction.execute(ignored -> {
            var entity = owned(transactionId, token, now, Status.CREATING_WOO);
            entity.recordWooOrder(order, now);
            records.saveAndFlush(entity);
            entityManager.clear();
            return TransactionPersistenceMapper.operation(records.findByTransactionId(transactionId).orElseThrow());
        });
    }

    @Override
    public Operation complete(String transactionId, String ownerToken, Instant now) {
        var token = UUID.fromString(ownerToken);
        return transaction.execute(ignored -> {
            var entity = owned(transactionId, token, now, Status.WOO_CONFIRMED);
            entity.complete(now);
            records.saveAndFlush(entity);
            entityManager.clear();
            return TransactionPersistenceMapper.operation(records.findByTransactionId(transactionId).orElseThrow());
        });
    }

    @Override
    public void release(String transactionId, String ownerToken, Instant now) {
        var token = UUID.fromString(ownerToken);
        transaction.executeWithoutResult(ignored -> records.findByTransactionId(transactionId).ifPresent(entity -> {
            if (entity.status() != Status.COMPLETED && token.equals(entity.ownerToken())) {
                entity.release(now);
                records.saveAndFlush(entity);
            }
        }));
    }

    private Claim claimOnce(ClaimRequest request, Instant now, Duration lease) {
        return records.findByOperationKey(request.operationKey())
            .map(entity -> claimExisting(entity, request, now, lease))
            .orElseGet(() -> {
                var token = UUID.randomUUID();
                var entity = new CheckoutOperationEntity(
                    UUID.randomUUID().toString(), request, token, now.plus(lease), now
                );
                records.saveAndFlush(entity);
                return new Claim(TransactionPersistenceMapper.operation(entity), token.toString());
            });
    }

    private Claim claimExisting(CheckoutOperationEntity entity, ClaimRequest request, Instant now, Duration lease) {
        if (!entity.subject().equals(request.subject())
            || !entity.commandHash().equals(request.commandHash())
            || !entity.wooReference().equals(request.wooReference())) {
            throw new CheckoutIdempotencyConflictException();
        }
        if (entity.status() != Status.COMPLETED
            && (entity.ownerToken() == null || !entity.leaseUntil().isAfter(now))) {
            var token = UUID.randomUUID();
            entity.claim(token, now.plus(lease), now);
            records.saveAndFlush(entity);
            return new Claim(TransactionPersistenceMapper.operation(entity), token.toString());
        }
        return new Claim(TransactionPersistenceMapper.operation(entity), null);
    }

    private CheckoutOperationEntity owned(
        String transactionId,
        UUID ownerToken,
        Instant now,
        Status expectedStatus
    ) {
        var entity = records.findByTransactionId(transactionId)
            .orElseThrow(() -> new IllegalStateException("checkout lease was lost"));
        if (!ownerToken.equals(entity.ownerToken())
            || entity.status() != expectedStatus
            || entity.leaseUntil() == null
            || !entity.leaseUntil().isAfter(now)) {
            throw new IllegalStateException("checkout lease was lost");
        }
        return entity;
    }
}
