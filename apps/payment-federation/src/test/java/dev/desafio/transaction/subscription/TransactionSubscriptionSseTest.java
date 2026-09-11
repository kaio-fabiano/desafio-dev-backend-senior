package dev.desafio.transaction.subscription;

import dev.desafio.transaction.transaction.application.event.TransactionEvent;
import dev.desafio.transaction.transaction.application.query.TransactionReadRepository;
import dev.desafio.transaction.transaction.application.query.TransactionView;
import dev.desafio.transaction.transaction.application.subscription.OnTransactionUpdated;
import dev.desafio.transaction.transaction.application.subscription.OnTransactionUpdatedHandler;
import dev.desafio.transaction.transaction.application.subscription.TransactionSubscriptionEventHandler;
import dev.desafio.transaction.transaction.application.subscription.TransactionSubscriptionGateway;
import dev.desafio.transaction.transaction.domain.Transaction;
import org.axonframework.messaging.eventhandling.gateway.EventGateway;
import org.axonframework.messaging.eventhandling.processing.streaming.token.store.TokenStore;
import org.axonframework.messaging.eventhandling.processing.streaming.token.store.inmemory.InMemoryTokenStore;
import org.axonframework.messaging.queryhandling.QueryUpdateEmitter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import reactor.core.publisher.Flux;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude="
            + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        "management.health.rabbit.enabled=false"
    }
)
@Import(TransactionSubscriptionSseTest.TestAxonConfiguration.class)
class TransactionSubscriptionSseTest {
    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private EventGateway events;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private TransactionReadRepository views;

    @Test
    @DisplayName("Checkout operation updates use the existing owner-scoped GraphQL SSE @spec:AC-337 @spec:AC-344 @spec:AC-350")
    void exposesTransactionFilteredSubscriptionContract() {
        acceptSubscriptionToken();

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth("subscription-token");
        var response = restTemplate.exchange(
            "/graphql",
            HttpMethod.POST,
            new HttpEntity<>(Map.of("query", "{ __schema { subscriptionType { fields { name } } } }"), headers),
            new ParameterizedTypeReference<Map<String, Object>>() {}
        );

        var names = fields(response.getBody()).stream().map(field -> field.get("name")).toList();
        assertTrue(names.contains("onTransactionUpdated"), names.toString());
        assertTrue(names.contains("orderEvents"), names.toString());
    }

    @Test
    @DisplayName("HTTP SSE isolates simultaneous owners and transactions, orders versions, and reconnects @spec:AC-289")
    void streamsOnlyTheOwnedTransactionOverRealHttpSse() {
        acceptSubscriptionToken();
        var current = new java.util.concurrent.ConcurrentHashMap<String, TransactionView>();
        current.put("transaction-a", view("transaction-a", "buyer-250", 1));
        current.put("transaction-b", view("transaction-b", "buyer-250", 4));
        when(views.findTransaction(anyString(), eq("buyer-250"))).thenAnswer(invocation ->
            Optional.ofNullable(current.get(invocation.<String>getArgument(0)))
        );

        var aPayloads = new ConcurrentLinkedQueue<String>();
        var bPayloads = new ConcurrentLinkedQueue<String>();
        var a = sse("transaction-a").subscribe(aPayloads::add, ignored -> {});
        var b = sse("transaction-b").subscribe(bPayloads::add, ignored -> {});
        await().atMost(Duration.ofSeconds(30)).until(() -> aPayloads.size() == 1 && bPayloads.size() == 1);
        assertPayload(aPayloads.remove(), "transaction-a", 1);
        assertPayload(bPayloads.remove(), "transaction-b", 4);

        events.publish(List.of(
            event("transaction-a", "buyer-250", 2),
            event("transaction-b", "buyer-250", 5)
        )).join();
        await().atMost(Duration.ofSeconds(30)).until(() -> aPayloads.size() == 1 && bPayloads.size() == 1);
        assertPayload(aPayloads.remove(), "transaction-a", 2);
        assertPayload(bPayloads.remove(), "transaction-b", 5);
        a.dispose();
        b.dispose();
        events.publish(List.of(
            event("transaction-a", "buyer-250", 3),
            event("transaction-b", "buyer-250", 6)
        )).join();

        current.put("transaction-a", view("transaction-a", "buyer-250", 4));
        var reconnectPayloads = new ConcurrentLinkedQueue<String>();
        var reconnect = sse("transaction-a").subscribe(reconnectPayloads::add, ignored -> {});
        await().atMost(Duration.ofSeconds(30)).until(() -> reconnectPayloads.size() == 1);
        assertPayload(reconnectPayloads.remove(), "transaction-a", 4);
        reconnect.dispose();
        events.publish(List.of(event("transaction-a", "buyer-250", 5))).join();
    }

    @Test
    @DisplayName("Subscription query suppresses stale versions and propagates cancellation @spec:AC-289 @spec:AC-231")
    void suppressesStaleVersionsAndReleasesOnCancel() {
        var subscriptions = mock(TransactionSubscriptionGateway.class);
        var cancelled = new AtomicBoolean();
        when(subscriptions.subscribe(any(OnTransactionUpdated.class)))
            .thenReturn(Flux.just(
                view("transaction-a", "buyer-250", 1),
                view("transaction-a", "buyer-250", 2),
                view("transaction-a", "buyer-250", 2),
                view("transaction-a", "buyer-250", 1),
                view("transaction-a", "buyer-250", 3)
            ).concatWith(Flux.<TransactionView>never().doOnCancel(() -> cancelled.set(true))));
        var handler = new OnTransactionUpdatedHandler(subscriptions, Optional.empty());

        var versions = new CopyOnWriteArrayList<Integer>();
        var subscription = handler.subscribe("transaction-a", "buyer-250")
            .subscribe(view -> versions.add(view.version()));
        await().atMost(Duration.ofSeconds(2)).until(() -> versions.equals(List.of(1, 2, 3)));
        subscription.dispose();
        await().atMost(Duration.ofSeconds(2)).untilTrue(cancelled);
    }

    @Test
    @DisplayName("QueryUpdateEmitter filters by transaction and authenticated owner @spec:AC-289")
    @SuppressWarnings({"rawtypes", "unchecked"})
    void emitsOnlyForTheMatchingOwnerAndTransaction() {
        var emitter = mock(QueryUpdateEmitter.class);
        var event = event("transaction-a", "buyer-250", 2);
        new TransactionSubscriptionEventHandler().on(event, emitter);
        var predicate = org.mockito.ArgumentCaptor.forClass(java.util.function.Predicate.class);

        verify(emitter).emit(eq(OnTransactionUpdated.class), predicate.capture(), eq(TransactionView.from(event)));

        assertTrue(predicate.getValue().test(new OnTransactionUpdated("transaction-a", "buyer-250")));
        assertFalse(predicate.getValue().test(new OnTransactionUpdated("transaction-b", "buyer-250")));
        assertFalse(predicate.getValue().test(new OnTransactionUpdated("transaction-a", "another-buyer")));
        assertTrue(predicate.getValue().test(OnTransactionUpdated.byOperationKey(
            "operation-transaction-a", "buyer-250"
        )));
    }

    @Test
    @DisplayName("Unauthenticated clients cannot open the Java SSE stream @spec:AC-289 @spec:AC-288")
    void rejectsUnauthenticatedSse() throws Exception {
        var response = HttpClient.newHttpClient().send(request("transaction-a", false), HttpResponse.BodyHandlers.discarding());
        assertEquals(401, response.statusCode());
    }

    @Test
    @DisplayName("Legacy orderEvents remains live through the Java SSE cutover @spec:AC-288 @spec:AC-289")
    void preservesLegacyOrderEventsSubscription() {
        acceptSubscriptionToken();
        var payloads = new ConcurrentLinkedQueue<String>();
        var connected = new AtomicBoolean();
        var subscription = sse("""
            subscription {
              orderEvents(operationKey: "operation-transaction-a") {
                operationKey orderId state pixCode eventTime
              }
            }
            """, connected).subscribe(payloads::add, ignored -> {});
        var version = new AtomicInteger(1);
        await().pollInterval(Duration.ofMillis(100)).atMost(Duration.ofSeconds(30)).until(() -> {
            events.publish(List.of(event("transaction-a", "buyer-250", version.incrementAndGet()))).join();
            return connected.get();
        });
        await().atMost(Duration.ofSeconds(30)).until(() -> !payloads.isEmpty());
        var payload = payloads.remove();
        assertTrue(payload.contains("\"operationKey\":\"operation-transaction-a\""), payload);
        assertTrue(payload.contains("\"orderId\":\"42\""), payload);
        assertTrue(payload.contains("\"state\":\"PIX_GENERATED\""), payload);
        assertTrue(payload.contains("\"pixCode\":\"PIX:provider-250\""), payload);
        subscription.dispose();
        events.publish(List.of(event(
            "transaction-a", "buyer-250", version.incrementAndGet()
        ))).join();
    }

    private void acceptSubscriptionToken() {
        var now = Instant.now();
        when(jwtDecoder.decode(anyString())).thenReturn(Jwt.withTokenValue("subscription-token")
            .header("alg", "RS256")
            .subject("buyer-250")
            .claim("scope", "orders:read")
            .issuedAt(now.minusSeconds(1))
            .expiresAt(now.plusSeconds(60))
            .build());
    }

    private Flux<String> sse(String transactionId) {
        return sse("subscription { onTransactionUpdated(transactionId: \"" + transactionId
            + "\") { transactionId version } }", new AtomicBoolean());
    }

    private Flux<String> sse(String query, AtomicBoolean connected) {
        return Flux.create(sink -> {
            var responseStream = new AtomicReference<InputStream>();
            sink.onDispose(() -> close(responseStream.getAndSet(null)));
            Thread.ofVirtual().start(() -> {
                try {
                    var stream = HttpClient.newHttpClient().send(
                        request(query, true), HttpResponse.BodyHandlers.ofInputStream()
                    ).body();
                    responseStream.set(stream);
                    connected.set(true);
                    try (var lines = new BufferedReader(
                        new InputStreamReader(stream, StandardCharsets.UTF_8)
                    ).lines()) {
                        lines.filter(line -> line.startsWith("data:"))
                            .map(line -> line.substring(5).strip())
                            .forEach(sink::next);
                    }
                    sink.complete();
                } catch (Exception error) {
                    if (!sink.isCancelled()) sink.error(error);
                }
            });
        });
    }

    private HttpRequest request(String query, boolean authenticated) {
        var body = "{\"query\":" + jsonString(query) + "}";
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/graphql"))
            .header("accept", "text/event-stream")
            .header("content-type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));
        if (authenticated) request.header("authorization", "Bearer subscription-token");
        return request.build();
    }

    private static String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n") + "\"";
    }

    private static void close(InputStream stream) {
        if (stream == null) return;
        try {
            stream.close();
        } catch (java.io.IOException ignored) {
            // Closing an already-disconnected SSE response is harmless.
        }
    }

    private static void assertPayload(String payload, String transactionId, int version) {
        assertTrue(payload.contains("\"transactionId\":\"" + transactionId + "\""), payload);
        assertTrue(payload.contains("\"version\":" + version), payload);
    }

    private static TransactionView view(String transactionId, String owner, int version) {
        return new TransactionView(
            transactionId, "operation-" + transactionId, owner, "42",
            new BigDecimal("19.90"), "BRL", "PIX", Transaction.Status.PAYMENT_PENDING,
            "provider-250", version
        );
    }

    private static TransactionEvent event(String transactionId, String owner, int version) {
        return new TransactionEvent(
            UUID.randomUUID(), transactionId, "operation-" + transactionId, owner, "42",
            List.of(new Transaction.Item("product-250", 1)), new BigDecimal("19.90"),
            "BRL", "PIX", null, null, Transaction.Outcome.PAYMENT_PENDING, "PIX:provider-250",
            Transaction.Status.PAYMENT_PENDING, version, Instant.now()
        );
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> fields(Map<String, Object> body) {
        var data = (Map<String, Object>) body.get("data");
        var schema = (Map<String, Object>) data.get("__schema");
        var subscription = (Map<String, Object>) schema.get("subscriptionType");
        return (List<Map<String, Object>>) subscription.get("fields");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestAxonConfiguration {
        @Bean
        TokenStore tokenStore() {
            return new InMemoryTokenStore();
        }

        @Bean
        TransactionSubscriptionEventHandler transactionSubscriptionEventHandler() {
            return new TransactionSubscriptionEventHandler();
        }
    }
}
