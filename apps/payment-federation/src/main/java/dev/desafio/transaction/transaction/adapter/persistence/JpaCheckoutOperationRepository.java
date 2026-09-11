package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.checkout.CheckoutIdempotencyConflictException;
import dev.desafio.transaction.transaction.checkout.CheckoutOperationRepository;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import dev.desafio.transaction.transaction.application.query.CheckoutOperationView;
import dev.desafio.transaction.transaction.application.subscription.CheckoutOperationCommitted;
import org.axonframework.messaging.eventhandling.gateway.EventGateway;
import jakarta.persistence.EntityManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Optional;

public final class JpaCheckoutOperationRepository implements CheckoutOperationRepository {
    private final CheckoutOperationJpaRepository records;
    private final EntityManager entityManager;
    private final TransactionTemplate transaction;
    private final EventGateway events;
    private final ObjectMapper json = new ObjectMapper();

    public JpaCheckoutOperationRepository(
        CheckoutOperationJpaRepository records,
        EntityManager entityManager,
        PlatformTransactionManager manager,
        EventGateway events
    ) {
        this.records = records;
        this.entityManager = entityManager;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.events = events;
    }

    @Override
    public Operation createOrLoad(CreateRequest request, Instant now) {
        try {
            return transaction.execute(ignored -> records.findBySubjectAndOperationKey(request.subject(), request.operationKey())
                .map(e -> validate(e, request))
                .orElseGet(() -> {
                    var entity = new CheckoutOperationEntity(request.operationId(), request.subject(), request.operationKey(), request.commandHash(), request.wooReference(), now);
                    records.saveAndFlush(entity);
                    return TransactionPersistenceMapper.operation(entity);
                }));
        } catch (DataIntegrityViolationException collision) {
            return transaction.execute(ignored -> records.findBySubjectAndOperationKey(request.subject(), request.operationKey())
                .map(e -> validate(e, request)).orElseThrow(() -> collision));
        }
    }

    @Override
    public boolean markWooCreationRequested(String id, Instant now) {
        var changed = transaction.execute(ignored -> records.markWooCreationRequested(id, now) == 1);
        if (changed) publish(id);
        return changed;
    }

    @Override
    public Operation recordWooOrder(String id, WooCommerceOrderPort.Order order, Instant now) {
        var operation = transaction.execute(ignored -> {
            try {
                records.recordWooOrder(id, order.id(), json.writeValueAsString(order.items()), order.amount(), order.currency(), now);
            } catch (JsonProcessingException error) {
                throw new IllegalStateException("Unable to serialize WooCommerce order items", error);
            }
            entityManager.clear();
            return TransactionPersistenceMapper.operation(records.findByOperationId(id).orElseThrow());
        });
        publish(view(operation));
        return operation;
    }

    @Override
    public Operation complete(String id, Instant now) {
        var operation = transaction.execute(ignored -> {
            records.complete(id, now);
            entityManager.clear();
            return TransactionPersistenceMapper.operation(records.findByOperationId(id).orElseThrow());
        });
        publish(view(operation));
        return operation;
    }

    @Override
    public Operation fail(String id, String reason, Instant now) {
        var operation = transaction.execute(ignored -> {
            records.fail(id, reason, now);
            entityManager.clear();
            return TransactionPersistenceMapper.operation(records.findByOperationId(id).orElseThrow());
        });
        publish(view(operation));
        return operation;
    }

    private void publish(String id) {
        records.findByOperationId(id).map(TransactionPersistenceMapper::checkoutView).ifPresent(this::publish);
    }

    private void publish(CheckoutOperationView view) {
        events.publish(java.util.List.of(new CheckoutOperationCommitted(view)));
    }

    private CheckoutOperationView view(Operation operation) {
        return new CheckoutOperationView(operation.operationId(), operation.operationKey(),
            operation.status() == CheckoutOperationRepository.Status.COMPLETED ? "COMPLETED"
                : operation.status() == CheckoutOperationRepository.Status.FAILED ? "FAILED" : "PROCESSING",
            operation.wooOrderId(), operation.paymentId(), operation.errorReason(), operation.subject());
    }

    @Override
    public Optional<Operation> find(String id, String subject) {
        return records.findByOperationIdAndSubject(id, subject).map(TransactionPersistenceMapper::operation);
    }

    private Operation validate(CheckoutOperationEntity e, CreateRequest request) {
        if (!e.operationId().equals(request.operationId()) || !e.commandHash().equals(request.commandHash())
            || !e.wooReference().equals(request.wooReference())) {
            throw new CheckoutIdempotencyConflictException();
        }
        return TransactionPersistenceMapper.operation(e);
    }
}
