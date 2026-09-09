package dev.desafio.transaction.transaction.adapter.woocommerce;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WooCommerceGraphQlOrderAdapterTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    @DisplayName("Woo ACL authenticates with its trusted origin and reconciles ambiguous checkout @spec:AC-285 @spec:AC-288")
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
}
