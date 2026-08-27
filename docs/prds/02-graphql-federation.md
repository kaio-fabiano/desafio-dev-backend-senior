# PRD 02 — GraphQL Federation, Connections, and DataLoader

## Expected outcome

A schema-first Apollo Federation v2 supergraph in which clients query identity,
orders, and products as a single graph, while each subgraph preserves data
ownership, authorization, and performance.

## WordPress integration guideline

The implementation order is **plugin-first**:

1. install WPGraphQL, WPGraphQL for WooCommerce, and the
   `wp-graphql-federations` indicated in the interview;
2. introspect and reuse existing types, Connections, queries, and mutations;
3. add only missing directives, reference resolvers, and ownership rules;
4. create a NestJS adapter or subgraph only for a gap reproduced by a test and
   recorded in an ADR.

Products, orders, cart, checkout, pagination, or loaders that plugins already
handle correctly will not be recreated. The federation plugin is a candidate,
not a guarantee: its compatibility with Federation v2 and WooCommerce types
must pass Rover composition and gateway E2E testing.

### Federation plugin administration

The federation plugin's administration screen is the first option for adding
supported directives such as `@key`, `@external`, and `@requires` to WordPress
types and fields. Configuration made in the screen cannot remain click-only:
bootstrap or export it into a versioned repository artifact, document how to
reapply it, and prove the resulting `_service.sdl` with Rover. A deterministic
publication-boundary normalization remains allowed only for a schema shape the
screen cannot represent, such as the interface gap recorded in ADR 003.

## Schema-first contract

- Every subgraph keeps versioned SDL in `libs/contracts/graphql/<subgraph>/`.
- The SDL, not TypeScript decorators, is the source of truth.
- Resolvers implement the contract generated from the SDL.
- Each SDL imports only the Federation directives it uses, through versioned `@link`.
- CI runs lint, local composition with Rover, and breaking-change checks.
- `supergraph.graphql` is reproducible build output and is never edited by hand.

Proposed local composition:

```bash
rover supergraph compose --config libs/contracts/graphql/supergraph.yaml \
  > dist/supergraph.graphql
```

## Type and field ownership

| Type/field | Owning subgraph | How it crosses the graph |
|---|---|---|
| `User` e `SupplierCompany` | identity | `User @key(fields: "id")` |
| `User.orders` | WordPress/WooCommerce | WordPress extends/references `User` and returns the native Connection |
| `Cart`, `Order`, `OrderItem` | WordPress/WooCommerce | `Order @key(fields: "id")` and native Woo types |
| `Order.workflow`, `Order.pixCode` | commerce | commerce extends `Order` using `wooOrderId` as the federated key |
| `OrderItem.product` | WordPress/WooCommerce | `Product { id }` representation |
| `Product`, `Category` | WordPress/WooCommerce | native entities and Connections, federated by stable key |
| `Product.supplier` | identity/WordPress | stable reference to the owning company |

Every `@key` needs a real reference resolver. The resolver must accept a batch of
representations through DataLoader and preserve order, including returning `null`
or a typed error for missing keys according to the contract.

## Minimum SDL sketch

```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.11", import: ["@key"])

type User @key(fields: "id") {
  id: ID!
  email: String!
}

type Order @key(fields: "id") {
  id: ID!
  status: OrderStatus!
  paymentMethod: PaymentMethod!
  pixCode: String
  items(first: Int, after: String): OrderItemConnection!
}

type Product @key(fields: "id") {
  id: ID!
}
```

The exact spec version must be pinned after library compatibility is confirmed.
Do not use the moving `v2.x` alias in reproducible artifacts without a conscious decision.

## Critical federated query

```graphql
query MeJourney($first: Int!) {
  me {
    id
    email
    orders(first: $first) {
      edges {
        node {
          id
          status
          paymentMethod
          pixCode
          items(first: 50) {
            edges {
              node {
                quantity
                product { id name price }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

This operation is simultaneously a functional contract, composition scenario,
and N+1 benchmark.

## Relay Cursor Connections

The Relay link indicated in the interview is a normative specification for this
project, not merely supplementary material. All pageable lists return
`XConnection`, `XEdge`, and `PageInfo`. The initial implementation provides
`first`/`after`; `last`/`before` is included only where the data source supports
correct reverse pagination.

Proposed cursor: base64url of a versioned structure, for example
`{"v":1,"createdAt":"...","id":"..."}`. It is opaque to the client but
decodable by the service. The query uses keyset pagination with total, stable
ordering `(created_at DESC, id DESC)` and fetches `first + 1` to calculate
`hasNextPage`. Never load all items to paginate in memory.

Rules:

- centralized default and maximum limits;
- an invalid cursor produces an input error, not a fallback to the first page;
- a changed filter/sort explicitly makes a prior cursor incompatible;
- `startCursor`/`endCursor` are null when there are no edges;
- the same logical ordering for forward and reverse pagination.

## DataLoader per request

- Instantiate loaders when creating the context for each GraphQL request.
- An instance is never shared between users or subscriptions.
- The cache key includes tenant/company when authorization depends on it.
- The batch function returns results in the same order as the received keys.
- `__resolveReference` reference resolvers use loaders, not direct access.
- WooCommerce loaders group IDs in a single operation supported by the adapter.
- After a mutation in the same request, clear/update affected entries.

DataLoader reduces calls and memoizes only within the request; it does not
replace distributed cache.

## Evidence against N+1

The E2E enables data-source counters per `requestId`:

- number of SQL queries per loader;
- number of HTTP/GraphQL calls to WordPress;
- size of each batch;
- federated query plan in test mode.

For N orders with M items, the critical query must keep the number of calls per
layer approximately constant, and never proportional to `N × M`.

## Distributed authorization

The gateway validates the signature, `iss`, `aud`, expiration, and scopes, then
propagates a signed context or bearer token. Subgraphs do not trust a `userId`
provided as an argument. The context contains `subject`, `scopes`, `audience`,
`supplierCompanyId`, and `requestId`; ownership rules live in the application/domain
of the owning subgraph.

## Composition gate

- passing local Rover composition;
- WordPress composes as a subgraph using the indicated plugin, without a custom
  wrapper, or the failure requiring a fallback is recorded by a test;
- no ownership conflicts or improper `@shareable` usage;
- every `@key` covered by a reference test;
- introspection verifies the Connections/PageInfo shape;
- the `me` query passes through the supergraph, not only isolated subgraphs;
- functional and acceptance tests exercise these operations through the gateway;
- a reviewable supergraph snapshot in the PR.

## Decisive risk: subscriptions

Apollo Router documents federated subscriptions with multipart HTTP from the router
to the client and WebSocket or HTTP callback between the router and subgraph. The
challenge requires `graphql-sse` for both segments. These protocols are not equivalent.
Before committing to the gateway, run the proof described in
[risks and decisions](08-riscos-e-decisoes-pendentes.md).

## Sources

- [GraphQL.org — Federation](https://graphql.org/learn/federation/)
- [Apollo Federation — page indicated in the interview](https://www.apollographql.com/federation)
- [Apollo Federation](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/federation)
- [Schema composition](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/composition)
- [Subgraph implementation](https://www.apollographql.com/docs/apollo-server/using-federation/apollo-subgraph-setup)
- [Relay Cursor Connections](https://relay.dev/graphql/connections.htm)
- [wp-graphql-federations](https://github.com/Manuel-Antunes/wp-graphql-federations)
- [WPGraphQL for WooCommerce](https://github.com/wp-graphql/wp-graphql-woocommerce)
- [DataLoader](https://github.com/graphql/dataloader)

Navigable note: [[GraphQL Federation]].
