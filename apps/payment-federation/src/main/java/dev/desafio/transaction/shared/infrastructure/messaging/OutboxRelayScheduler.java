package dev.desafio.transaction.shared.infrastructure.messaging;

import org.springframework.scheduling.annotation.Scheduled;

public final class OutboxRelayScheduler {
    private final OutboxRelay relay;

    public OutboxRelayScheduler(OutboxRelay relay) {
        this.relay = relay;
    }

    @Scheduled(fixedDelayString = "${messaging.outbox.fixed-delay-ms:1000}")
    public void publish() {
        relay.publishAvailable(100);
    }
}
