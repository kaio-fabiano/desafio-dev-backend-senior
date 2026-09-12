package dev.desafio.transaction.transaction.adapter.woocommerce;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.application.checkout.WooCommerceOrderPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WooCommerceGraphQlOrderAdapterTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    @DisplayName("Woo createOrFind is lookup-then-create, not atomic idempotency @spec:AC-342")
    void wooAclReconcilesAnAmbiguousCheckoutByItsOperationReference() throws Exception {
        var lookups = new AtomicInteger();
        var calls = new ArrayList<WooCommerceGraphQlOrderAdapter.Call>();
        WooCommerceGraphQlOrderAdapter.GraphQlClient client = call -> {
            calls.add(call);
            if (call.query().contains("LoginTransaction")) return json("{\"login\":{\"authToken\":\"service-token\"}}");
            if (call.query().contains("FindOrderByTransactionReference")) {
                return lookups.incrementAndGet() == 1
                    ? json("{\"orders\":{\"nodes\":[]}}")
                    : json(orderPayload());
            }
            if (call.query().contains("TransactionCart")) return json(cartPayload());
            return json("{\"checkout\":{\"order\":{}}}");
        };
        var adapter = new WooCommerceGraphQlOrderAdapter(
            client, "transaction", "site-token", "http://wordpress"
        );

        var order = adapter.createOrFind(new WooCommerceOrderPort.Request(
            "buyer-1", "operation-reference", "PIX",
            new WooCommerceOrderPort.Session("cart-token", "woo-session", "buyer-cookie")
        ));

        assertEquals("42", order.id());
        assertEquals("19.90", order.amount().toPlainString());
        assertEquals(2, lookups.get());
        assertTrue(calls.stream().anyMatch(call -> call.variables().toString().contains(
            "_order_workflow_operation_reference"
        )));
        assertTrue(calls.stream()
            .filter(call -> call.query().contains("LoginTransaction")
                || call.query().contains("FindOrderByTransactionReference"))
            .noneMatch(call -> call.headers().containsKey("cart-token")
                || call.headers().containsKey("woocommerce-session")
                || call.headers().containsKey("cookie")));
        assertTrue(calls.stream().allMatch(call ->
            "http://wordpress".equals(call.headers().get("origin"))
        ));
        assertTrue(calls.stream()
            .filter(call -> call.query().contains("TransactionCart")
                || call.query().contains("TransactionCheckout"))
            .allMatch(call -> "cart-token".equals(call.headers().get("cart-token"))));
    }

    @Test
    @DisplayName("Woo lookup preserves missing, malformed, duplicate, and failed recovery outcomes @spec:AC-243")
    void wooLookupPreservesRecoveryOutcomes() throws Exception {
        var request = new WooCommerceOrderPort.Request(
            "buyer-1", "operation-reference", "PIX",
            new WooCommerceOrderPort.Session("cart-token", "woo-session", "buyer-cookie")
        );

        assertNull(adapter(call -> response(call, "{\"orders\":{\"nodes\":[]}}")).findByReference(request));
        assertThrows(IllegalStateException.class, () ->
            adapter(call -> response(call, "{\"orders\":{\"nodes\":{}}}")).findByReference(request)
        );
        assertThrows(IllegalStateException.class, () ->
            adapter(call -> response(call, duplicateOrderPayload())).findByReference(request)
        );
        assertThrows(IllegalStateException.class, () ->
            adapter(call -> {
                if (call.query().contains("LoginTransaction")) return response(call, "");
                throw new IllegalStateException("WooGraphQL request failed");
            }).findByReference(request)
        );
    }

    @Test
    @DisplayName("Woo checkout authenticates the linked buyer and preserves the cart session @spec:AC-354")
    void wooCheckoutAuthenticatesTheLinkedBuyer() throws Exception {
        var calls = new ArrayList<WooCommerceGraphQlOrderAdapter.Call>();
        WooCommerceGraphQlOrderAdapter.GraphQlClient client = call -> {
            calls.add(call);
            if (call.query().contains("LoginTransaction")) {
                var identity = call.variables().get("input").toString();
                return json(identity.contains("buyer-1")
                    ? "{\"login\":{\"authToken\":\"buyer-token\"}}"
                    : "{\"login\":{\"authToken\":\"service-token\"}}");
            }
            if (call.query().contains("FindOrderByTransactionReference")) {
                return json("{\"orders\":{\"nodes\":[]}}");
            }
            if (call.query().contains("TransactionCart")) return json(cartPayload());
            return json("{\"checkout\":{\"order\":{\"databaseId\":42}}}");
        };

        adapter(client).createOrFind(new WooCommerceOrderPort.Request(
            "buyer-1", "operation-reference", "PIX",
            new WooCommerceOrderPort.Session("cart-token", "woo-session", "buyer-cookie")
        ));

        var checkout = calls.stream()
            .filter(call -> call.query().contains("TransactionCheckout"))
            .toList();
        assertEquals(1, checkout.size());
        assertEquals("Bearer buyer-token", checkout.getFirst().headers().get("authorization"));
        assertEquals("cart-token", checkout.getFirst().headers().get("cart-token"));
        assertTrue(calls.stream().anyMatch(call ->
            call.query().contains("LoginTransaction")
                && call.variables().get("input").toString().contains("buyer-1")
        ));
    }

    private static WooCommerceGraphQlOrderAdapter adapter(
        WooCommerceGraphQlOrderAdapter.GraphQlClient client
    ) {
        return new WooCommerceGraphQlOrderAdapter(client, "transaction", "site-token", "http://wordpress");
    }

    private static JsonNode response(WooCommerceGraphQlOrderAdapter.Call call, String orders) throws Exception {
        return call.query().contains("LoginTransaction")
            ? json("{\"login\":{\"authToken\":\"service-token\"}}")
            : json(orders);
    }

    private static JsonNode json(String value) throws Exception {
        return JSON.readTree(value);
    }

    private static String cartPayload() {
        return """
            {"cart":{"total":"19.90","contents":{"nodes":[
              {"quantity":2,"product":{"node":{"databaseId":1001}}}
            ]}}}
            """;
    }

    private static String orderPayload() {
        return """
            {"orders":{"nodes":[{
              "databaseId":42,"total":"19.90","currency":"BRL",
              "metaData":[{"key":"_order_workflow_operation_reference","value":"operation-reference"}],
              "lineItems":{"nodes":[{"quantity":2,"product":{"node":{"databaseId":1001}}}]}
            }]}}
            """;
    }

    private static String duplicateOrderPayload() {
        return """
            {"orders":{"nodes":[
              {"databaseId":42,"total":"19.90","currency":"BRL",
               "metaData":[{"key":"_order_workflow_operation_reference","value":"operation-reference"}],
               "lineItems":{"nodes":[{"quantity":2,"product":{"node":{"databaseId":1001}}}]}},
              {"databaseId":43,"total":"19.90","currency":"BRL",
               "metaData":[{"key":"_order_workflow_operation_reference","value":"operation-reference"}],
               "lineItems":{"nodes":[{"quantity":2,"product":{"node":{"databaseId":1001}}}]}}
            ]}}
            """;
    }
}
