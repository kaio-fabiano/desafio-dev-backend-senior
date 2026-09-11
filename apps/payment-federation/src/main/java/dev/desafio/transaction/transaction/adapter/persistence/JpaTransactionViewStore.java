package dev.desafio.transaction.transaction.adapter.persistence;

import dev.desafio.transaction.transaction.application.TransactionViewStore;
import dev.desafio.transaction.transaction.domain.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;

public final class JpaTransactionViewStore implements TransactionViewStore {
    private final TransactionViewJpaRepository records;
    private final TransactionTemplate transaction;

    public JpaTransactionViewStore(
        TransactionViewJpaRepository records,
        PlatformTransactionManager transactionManager
    ) {
        this.records = records;
        transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
    }

    @Override
    public void upsert(TransactionEvent event) {
        try {
            transaction.executeWithoutResult(ignored -> upsertOnce(event));
        } catch (DataIntegrityViolationException collision) {
            transaction.executeWithoutResult(ignored -> {
                var existing = records.findByTransactionId(event.transactionId()).orElseThrow(() -> collision);
                if (existing.apply(event)) records.saveAndFlush(existing);
            });
        }
    }

    @Override
    public Optional<TransactionView> find(String transactionId) {
        return records.findById(transactionId).map(TransactionPersistenceMapper::transactionView);
    }

    private void upsertOnce(TransactionEvent event) {
        var existing = records.findByTransactionId(event.transactionId());
        if (existing.isEmpty()) {
            records.saveAndFlush(new TransactionViewEntity(event));
        } else if (existing.orElseThrow().apply(event)) {
            records.saveAndFlush(existing.orElseThrow());
        }
    }
}
