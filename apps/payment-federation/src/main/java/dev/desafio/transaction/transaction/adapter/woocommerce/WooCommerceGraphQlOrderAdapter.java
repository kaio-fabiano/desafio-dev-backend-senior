package dev.desafio.transaction.transaction.adapter.woocommerce;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.desafio.transaction.transaction.checkout.WooCommerceOrderPort;
import dev.desafio.transaction.transaction.domain.Transaction;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class WooCommerceGraphQlOrderAdapter implements WooCommerceOrderPort {
    private static final String REFERENCE_KEY = "_order_workflow_operation_reference";

    private final GraphQlClient client;
    private final String serviceIdentity;
    private final String siteToken;

    public WooCommerceGraphQlOrderAdapter(GraphQlClient client, String serviceIdentity, String siteToken) {
        this.client = Objects.requireNonNull(client, "client");
        this.serviceIdentity = required(serviceIdentity, "serviceIdentity");
        this.siteToken = required(siteToken, "siteToken");
    }

    public static WooCommerceGraphQlOrderAdapter connect(
        URI wordpress,
        String serviceIdentity,
        String siteToken,
        ObjectMapper json
    ) {
        return new WooCommerceGraphQlOrderAdapter(
            new HttpGraphQlClient(wordpress.resolve("/graphql"), json), serviceIdentity, siteToken
        );
    }

    @Override
    public Order createOrFind(Request request) throws Exception {
        var existing = findByReference(request);
        if (existing != null) return existing;
        var cart = currentCart(request);
        var input = Map.of(
            "clientMutationId", request.reference(),
            "paymentMethod", "cod",
            "metaData", List.of(Map.of("key", REFERENCE_KEY, "value", request.reference()))
        );
        var checkout = client.execute(new Call(
            """
                mutation TransactionCheckout($input: CheckoutInput!) {
                  checkout(input: $input) { order { databaseId } }
                }
                """,
            Map.of("input", input),
            sessionHeaders(request)
        ));
        var id = checkout.path("checkout").path("order").path("databaseId").asLong();
        if (id > 0) return new Order(Long.toString(id), cart.items(), cart.amount(), cart.currency());
        var reconciled = findByReference(request);
        if (reconciled == null) throw new AmbiguousResponseException();
        return reconciled;
    }

    @Override
    public Order findByReference(Request request) throws Exception {
        var login = client.execute(new Call(
            """
                mutation LoginTransaction($input: LoginInput!) {
                  login(input: $input) { authToken }
                }
                """,
            Map.of("input", Map.of("identity", serviceIdentity, "provider", "SITETOKEN")),
            Map.of("x-wpgraphql-site-token", siteToken)
        ));
        var token = login.path("login").path("authToken").asText();
        if (token.isBlank()) throw new IllegalStateException("WooGraphQL service login failed");
        var data = client.execute(new Call(
            """
                query FindOrderByTransactionReference($reference: String!) {
                  orders(first: 2, where: { search: $reference }) {
                    nodes {
                      databaseId total(format: RAW) currency metaData { key value }
                      lineItems(first: 100) { nodes { quantity product { node { databaseId } } } }
                    }
                  }
                }
                """,
            Map.of("reference", request.reference()),
            Map.of("authorization", "Bearer " + token)
        ));
        var matches = new ArrayList<JsonNode>();
        var nodes = data.path("orders").path("nodes");
        if (!nodes.isArray()) throw new IllegalStateException("WooCommerce orders are invalid");
        nodes.forEach(order -> {
            for (var metadata : order.path("metaData")) {
                if (REFERENCE_KEY.equals(metadata.path("key").asText())
                    && request.reference().equals(metadata.path("value").asText())) {
                    matches.add(order);
                    break;
                }
            }
        });
        if (matches.size() > 1) throw new IllegalStateException("WooCommerce operation reference is not unique");
        return matches.isEmpty() ? null : order(matches.getFirst());
    }

    private Cart currentCart(Request request) throws Exception {
        var data = client.execute(new Call(
            """
                query TransactionCart {
                  cart {
                    total(format: RAW)
                    contents { nodes { quantity product { node { databaseId } } } }
                  }
                }
                """,
            Map.of(),
            sessionHeaders(request)
        ));
        var cart = data.path("cart");
        if (cart.isMissingNode() || cart.isNull()) throw new IllegalStateException("WooCommerce cart is missing");
        return new Cart(items(cart.path("contents").path("nodes")), amount(cart.path("total").asText()), "BRL");
    }

    private Order order(JsonNode order) {
        var id = order.path("databaseId").asLong();
        if (id < 1) throw new IllegalStateException("Stored Woo order id is invalid");
        var currency = order.path("currency").asText("BRL");
        return new Order(
            Long.toString(id), items(order.path("lineItems").path("nodes")),
            amount(order.path("total").asText()), currency
        );
    }

    private List<Transaction.Item> items(JsonNode nodes) {
        if (!nodes.isArray() || nodes.isEmpty()) throw new IllegalStateException("WooCommerce items are invalid");
        var items = new ArrayList<Transaction.Item>();
        nodes.forEach(item -> items.add(new Transaction.Item(
            item.path("product").path("node").path("databaseId").asText(),
            item.path("quantity").asInt()
        )));
        return List.copyOf(items);
    }

    private BigDecimal amount(String value) {
        var amount = new BigDecimal(value);
        if (amount.signum() <= 0 || amount.scale() > 2) {
            throw new IllegalStateException("WooCommerce amount is invalid");
        }
        return amount;
    }

    private Map<String, String> sessionHeaders(Request request) {
        if (request.session() == null) return Map.of();
        var headers = new java.util.LinkedHashMap<String, String>();
        if (hasText(request.session().cartToken())) headers.put("cart-token", request.session().cartToken());
        if (hasText(request.session().wooSession())) {
            headers.put("woocommerce-session", request.session().wooSession());
        }
        if (hasText(request.session().cookie())) headers.put("cookie", request.session().cookie());
        return Map.copyOf(headers);
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record Call(String query, Map<String, ?> variables, Map<String, String> headers) {}

    @FunctionalInterface
    public interface GraphQlClient {
        JsonNode execute(Call call) throws Exception;
    }

    private record Cart(List<Transaction.Item> items, BigDecimal amount, String currency) {}

    private static final class HttpGraphQlClient implements GraphQlClient {
        private final URI endpoint;
        private final ObjectMapper json;
        private final HttpClient http = HttpClient.newHttpClient();

        private HttpGraphQlClient(URI endpoint, ObjectMapper json) {
            this.endpoint = endpoint;
            this.json = json;
        }

        @Override
        public JsonNode execute(Call call) throws Exception {
            var body = json.writeValueAsBytes(Map.of("query", call.query(), "variables", call.variables()));
            var request = HttpRequest.newBuilder(endpoint)
                .header("content-type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(body));
            call.headers().forEach(request::header);
            var response = http.send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("WooGraphQL request failed: " + response.statusCode());
            }
            var payload = json.readTree(response.body());
            if ((payload.path("errors").isArray() && !payload.path("errors").isEmpty())
                || payload.path("data").isMissingNode()) {
                throw new IllegalStateException("WooGraphQL returned errors");
            }
            return payload.path("data");
        }
    }
}
