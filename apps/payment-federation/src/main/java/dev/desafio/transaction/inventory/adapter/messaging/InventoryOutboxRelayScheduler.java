package dev.desafio.transaction.inventory.adapter.messaging;

import dev.desafio.transaction.shared.infrastructure.messaging.OutboxRelay;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnBean(name = "inventoryOutboxRelay")
@ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "true", matchIfMissing = true)
public final class InventoryOutboxRelayScheduler {
    private final OutboxRelay relay;

    public InventoryOutboxRelayScheduler(
        @Qualifier("inventoryOutboxRelay") OutboxRelay relay
    ) {
        this.relay = relay;
    }

    @Scheduled(fixedDelayString = "${inventory.outbox.fixed-delay-ms:1000}")
    public void publish() {
        relay.publishAvailable(100);
    }
}
