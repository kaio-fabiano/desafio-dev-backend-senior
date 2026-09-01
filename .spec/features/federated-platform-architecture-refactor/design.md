# Design: Federated platform architecture refactor

## Goal

Converge the proof of concept on six deployable applications while preserving
its tested marketplace journey. The design uses strategic DDD to establish
ownership, tactical DDD only where invariants justify it, and CQRS only where
read and write behavior genuinely differ.

## Target topology

```text
Apollo MCP ─┐
            v
Client -> Gateway -> Identity Federation
                  -> WordPress Federation
                  -> Payment Federation

Order subscription client -> NestJS subscription endpoint
```

| Runtime              | Responsibility                                                                                       | Explicitly does not own                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Gateway              | Supergraph composition, token verification, authenticated context propagation                        | Loaders, repositories, commerce rules, subscription proxy                                |
| Identity Federation  | Better Auth, OAuth resources/plugins, account linkage, identity GraphQL fields                       | Mirrored Better Auth tables, commercial customer/order data                              |
| WordPress Federation | Thin NestJS federation adapter over native WPGraphQL/WooGraphQL plus the order subscription endpoint | Duplicate loaders, commercial persistence, payment state machine, gateway authentication |
| Payment Federation   | Payment aggregate, idempotent commands, compensation, payment views                                  | Orders, inventory, identity sessions                                                     |
| Apollo MCP           | Reviewed operations and bearer-token forwarding                                                      | A custom MCP server or independent authorization rules                                   |

## Boundary policy

- Applications are composition roots and bootstrap only framework modules.
- Reusable implementation lives in focused Nx libraries owned by one context or
  in a platform library proven to have at least two consumers.
- Domain code imports no NestJS, Spring GraphQL, ORM, RabbitMQ, HTTP, or
  WordPress implementation.
- GraphQL controllers/resolvers are inbound adapters and contain no business
  workflow.
- Context integrations cross narrow ports or versioned event contracts.
- Nx tags and executable architecture tests enforce dependency direction.

## NestJS composition

`main.ts` creates the Nest application, enables shutdown hooks, and listens. A
module owns all other composition. Configuration is provided by asynchronous
module factories. Infrastructure clients and lifecycle resources are providers
with explicit shutdown behavior.

Identity uses `NestJSBetterAuth` from `@thallesp/nestjs-better-auth`. Each Better
Auth plugin has one injectable factory so configuration and dependencies remain
testable. Better Auth's handler and APIs replace the manual HTTP bridge and raw
queries against its tables.

The gateway configures Apollo Gateway through providers. It verifies tokens and
propagates authenticated context, but subgraphs independently authorize
sensitive operations. Request batching belongs to an owning subgraph or native
WordPress plugin, never to the gateway.

## Persistence decision

MikroORM is not part of the target by default:

- Better Auth owns Identity relational records.
- WordPress/WooCommerce owns commercial records.
- Spring Payment owns payment records through its existing database adapter.

MikroORM may be introduced later only for a demonstrated NestJS-owned aggregate,
using its native Unit of Work, Identity Map, request context, migrations, and a
context-specific repository adapter. It will not mirror another product's
schema or exist only to demonstrate an ORM.

## WordPress federation

The NestJS application is a thin anti-corruption and federation boundary. It
must delegate the native WPGraphQL request lifecycle rather than reproduce it.
Official WPGraphQL documentation confirms that WordPress already provides the
GraphQL endpoint, lazy field resolvers, per-request loaders, and a Model Layer
that centralizes capabilities and field visibility. WPGraphQL for WooCommerce
already provides product, customer, order, refund, cart/session, and checkout
operations.

The implementation order remains plugin-first:

1. WPGraphQL;
2. WPGraphQL for WooCommerce;
3. the selected Federation integration;
4. a thin NestJS federation/delegation adapter;
5. versioned configuration/publication normalization;
6. minimal custom resolver or PHP only for a tested gap.

The adapter does not create its own product/order repositories, cart model,
WooCommerce DataLoader, or capability system. It maps authenticated federation
context to a supported WordPress authentication mechanism and delegates native
queries and mutations. A schema delegation library must be evaluated before any
custom remote-execution layer is implemented.

The separate Stock deployment is retired only after cart, checkout, inventory,
idempotency, compensation, and composed-query acceptance scenarios pass through
the new owners.

## Payment DDD and CQRS

Payment is the behavior-rich bounded context. Its aggregate protects state
transitions and idempotency. A transactional command handler loads and changes
the aggregate; query handlers return dedicated views. Spring beans provide the
handlers and adapters, so no custom command bus is required. Spring GraphQL
Federation provides the inbound adapter. Axon and event sourcing are excluded
until replayable event history or a distributed command bus becomes a proven
requirement.

## Subscriptions

Federation composition and order subscriptions are separate transports. The
gateway does not proxy subscriptions. A NestJS GraphQL module inside WordPress
Federation owns the schema, resolver, authentication guard, per-user filtering,
lifecycle, and cleanup. After Nest application initialization, an injectable
SSE transport adapter reads the executable schema from `GraphQLSchemaHost` and
passes that exact `GraphQLSchema` instance to the official `graphql-sse`
handler. The adapter does not build, copy, introspect, or remotely fetch another
schema.

The official WPGraphQL subscriptions plugin is not selected as the security
boundary because it is explicitly experimental and still lists subscription
authentication and authorization as unfinished. It remains a useful reference
for mapping WordPress hooks to order events.

## Migration order

1. Lock architecture tests and target contracts.
2. Create only proven shared NestJS providers.
3. Refactor Identity and Gateway independently.
4. Establish WordPress and Payment subgraphs independently.
5. Establish the standalone subscription endpoint.
6. Compose the target graph and retire Commerce/Stock.
7. Run all quality and end-to-end gates and publish the walkthrough.

## Risks and mitigations

| Risk                                                                           | Mitigation                                                                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| WooCommerce plugin lacks required federation behavior                          | Reproduce the exact gap before adding a custom resolver or PHP extension                                                   |
| Nest adapter duplicates WPGraphQL loaders or authorization                     | Delegate native operations and assert that no commercial repository/loader exists in NestJS                                |
| Removing Commerce loses saga/idempotency guarantees                            | Keep old runtime until replacement acceptance tests pass; migrate one invariant at a time                                  |
| Better Auth integration lacks required OAuth-provider hook                     | Verify the installed integration API before designing an adapter; keep custom code behind a provider only for a proven gap |
| Spring Federation library version conflicts with current Boot/GraphQL versions | Add a focused composition test before moving handlers                                                                      |
| SSE transport drifts from the Apollo schema                                    | Reuse the post-initialization `GraphQLSchemaHost.schema` instance and prove schema identity in an integration test         |
| Refactor turns into folder-only DDD                                            | Tests assert dependencies and behavior; no empty abstractions or one-use generic frameworks                                |
