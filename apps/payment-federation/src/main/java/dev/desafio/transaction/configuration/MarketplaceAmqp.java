package dev.desafio.transaction.configuration;

public final class MarketplaceAmqp {
    public static final String EVENTS_EXCHANGE = "marketplace.events.v1";
    public static final String RETRY_EXCHANGE = "marketplace.retry.v1";
    public static final String DEAD_LETTER_EXCHANGE = "marketplace.dead-letter.v1";
    public static final long[] RETRY_DELAYS = {1_000, 10_000, 60_000};

    private MarketplaceAmqp() {}

    public static String eventQueue(String consumer) {
        return consumer + ".events.v1";
    }

    public static String retryQueue(String consumer, int attempt) {
        return eventQueue(consumer) + ".retry." + attempt;
    }

    public static String retryRoutingKey(String consumer, int attempt) {
        return consumer + "." + attempt;
    }

    public static String retryReturnRoutingKey(String consumer) {
        return "retry." + consumer;
    }

    public static String deadLetterQueue(String consumer) {
        return consumer + ".dlq.v1";
    }
}
