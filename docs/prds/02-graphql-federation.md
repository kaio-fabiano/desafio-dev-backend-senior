# PRD 02 — GraphQL Federation, Connections, and DataLoader

## Expected outcome

Clients use one authenticated Gateway for federated queries and mutations.
Identity Federation, Payment Federation, and WordPress Federation own their
schemas, authorization, data access, and batching. The executable boundaries
are fixed by [ADR 007](../adrs/007-federated-platform-boundaries.md).

## Graph boundaries

| Component            | Owns                                                                                         | Does not own                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Gateway              | JWT verification, safe context propagation, supergraph composition, query/mutation execution | Business resolvers, repositories, DataLoaders, commerce clients, or subscription proxying |
| Identity Federation  | Identity fields, registration, OAuth, sessions, and identity authorization                   | WooCommerce or payment state                                                              |
| Payment Federation   | Payment commands, views, entity references, and payment authorization                        | Commercial order, catalog, cart, or stock state                                           |
| WordPress Federation | Product, cart, order, customer, inventory, native Connections, and order subscriptions       | Reimplemented WooCommerce repositories, models, or loaders                                |

Apollo MCP calls registered operations through Gateway and does not bypass an
owning federation.

## WordPress federation boundary

The integration remains plugin-first and schema-first, with one loader instance
per request when the native data source requires first-party batching.

The WordPress runtime is a thin NestJS boundary around native capabilities:

1. install and configure WPGraphQL, GraphQL for eCommerce, and the pinned
   federation integration;
2. publish a reproducible Federation v2 SDL from the native schema;
3. delegate product, cart, order, customer, inventory, pagination, batching,
   and capability checks to WPGraphQL/WooGraphQL;
4. add custom plugin or adapter code only for a capability gap reproduced by a
   failing compatibility test.

Publication-boundary normalization remains allowed for the interface shape
proved in ADR 003. It changes the published SDL, not native resolvers or models.
The NestJS application is not a second commercial GraphQL implementation.

## Schema-first contract

- Each subgraph keeps versioned SDL in `libs/contracts/graphql/<subgraph>/`.
- SDL, not decorators, is the composition source of truth.
- Each SDL imports only the Federation directives it uses through a pinned
  `@link` version.
- Resolvers and controllers implement the versioned contract.
- CI runs lint, local Rover composition, breaking-change checks, and reference
  tests. Generated `supergraph.graphql` is never edited by hand.

Local composition remains reproducible:

```sh
rover supergraph compose --config libs/contracts/graphql/supergraph.yaml \
  > dist/supergraph.graphql
```

## Type and field ownership

| Type or field                                       | Owner                       | Federation path                                                     |
| --------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| `User`, identity fields, and registration           | Identity Federation         | `User @key(fields: "id")`                                           |
| `User.orders`                                       | WordPress Federation        | WordPress references `User` and returns the native order Connection |
| `Product`, `Category`, `Cart`, `Order`, `OrderItem` | WordPress Federation        | Native Woo types with stable keys where composition needs them      |
| `Payment` and payment operations                    | Payment Federation          | `Payment @key` and an order reference, without owning the order     |
| `Order.payment` or equivalent payment view          | Payment Federation          | Payment extends or references the WordPress-owned `Order`           |
| `Product.supplier`                                  | Identity/WordPress contract | Stable supplier-company reference, authorized by the owner          |

Every `@key` has a reference test. A reference resolver preserves input order
and returns the contract's null/error result for missing keys.

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
          payment {
            id
            status
            pixCode
          }
          items(first: 50) {
            edges {
              node {
                quantity
                product {
                  id
                  name
                  price
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

This operation is a composition contract, authorization scenario, and N+1
benchmark. It runs through Gateway; isolated subgraph success is insufficient.

## Connections and batching

Native WordPress Connections remain authoritative for commercial lists. New
first-party pageable fields follow the Relay Connection shape with opaque,
versioned cursors, stable keyset ordering, centralized limits, and explicit
invalid-cursor errors.

DataLoader belongs beside the data source that benefits from batching:

- WordPress Federation reuses native WPGraphQL deferred loaders rather than
  duplicating them in NestJS.
- Any first-party loader is request-scoped and includes tenant/company in its
  cache key when authorization depends on it.
- Reference batches preserve representation order.
- Mutation code clears or updates affected request-local entries.
- Gateway never loads domain data and therefore has no catalog/order loader.

E2E counters record database or upstream calls by `requestId`. The critical
query must keep calls approximately constant rather than proportional to the
number of orders multiplied by items.

## Distributed authorization

Gateway validates signature, issuer, audience, expiration, and edge scopes,
then propagates a signed context or bearer token. The propagated identity
contains `subject`, `scopes`, `audience`, `supplierCompanyId`, and `requestId`.
It never accepts a client-provided identity argument as authority.

Identity, Payment, and WordPress independently reject missing scopes and enforce
ownership for sensitive fields and mutations. Passing Gateway authentication is
not proof of subgraph authorization.

## Subscription endpoint

GraphQL-over-SSE is preserved, but it is not proxied by Gateway. WordPress
Federation exposes the documented subscription endpoint. After NestJS Apollo
initializes, the adapter obtains the existing executable schema from
`GraphQLSchemaHost` and passes that exact instance to the official
`graphql-sse` handler.

NestJS providers own authentication, filtering, transition publication,
heartbeat, cancellation, backpressure, and cleanup. The adapter does not fetch,
rebuild, or maintain a second schema.

## Composition gate

- Rover composes Identity, Payment, and WordPress with no ownership conflict or
  unjustified `@shareable` field.
- Native WordPress Connections, reference resolution, batching, and capability
  authorization retain their compatibility evidence.
- Every sensitive subgraph operation rejects invalid propagated identity.
- The critical `me` operation succeeds through Gateway.
- The subscription lifecycle succeeds through the WordPress Federation SSE
  endpoint while Gateway contains no subscription transport.
- The review includes a reproducible supergraph snapshot.

## Deliberate omissions

There is no Gateway DataLoader, commerce repository, WordPress REST aggregation,
custom WooCommerce GraphQL model, or subscription proxy. Schema delegation and
native plugin behavior are preferred to handwritten remote execution. Add an
abstraction only when a focused failing test proves the native path insufficient.

## Executable evidence

- `test/federated-platform-refactor.test.mjs` verifies that this PRD remains
  linked to ADR 007 and its executable runtime contract.
- `test/architecture-boundaries.test.mjs` prevents GraphQL/framework imports in
  domain and application code.
- Gateway, Identity, WordPress, Payment, subscription, composition, batching,
  and authorization tests provide focused evidence during their refactor tasks.
- Rover composition and the Gateway end-to-end journey are required final gates.

## Sources

- [GraphQL.org — Federation](https://graphql.org/learn/federation/)
- [Apollo Federation](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/federation)
- [Apollo subgraph setup](https://www.apollographql.com/docs/apollo-server/using-federation/apollo-subgraph-setup)
- [Relay Cursor Connections](https://relay.dev/graphql/connections.htm)
- [WPGraphQL for WooCommerce](https://github.com/wp-graphql/wp-graphql-woocommerce)
- [wp-graphql-federations](https://github.com/Manuel-Antunes/wp-graphql-federations)
- [DataLoader](https://github.com/graphql/dataloader)
- [GraphQL over SSE](https://github.com/enisdenjo/graphql-sse)
