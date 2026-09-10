# PRD 04 — Cart, payment transitions, and real time

## Expected outcome

An authenticated buyer uses native WooCommerce cart and order capabilities,
executes an idempotent payment command, and observes order transitions through
GraphQL over SSE. The final query and stream agree without a Node Order Workflow
subgraph, Stock worker, or Gateway-owned workflow state. The process boundaries follow
[ADR 007](../adrs/007-federated-platform-boundaries.md).

## Ownership and invariants

### Cart, order, and inventory

- WordPress/WooCommerce is the authoritative source for cart, item price,
  customer, order, status, and stock.
- WordPress Federation delegates those operations to native
  WPGraphQL/WooGraphQL capabilities and WordPress authorization.
- A cart and order are resolved from the authenticated subject; a client-sent
  `userId` is never authority.
- Product price and availability are revalidated by the native checkout path.
- Stock reservation, release, and commercial status changes use WooCommerce
  semantics rather than a second inventory aggregate.

### Payment

- Payment Federation owns the Payment aggregate and its allowed transitions.
- Commands use an operation key and canonical payload hash.
- One transaction enforces the aggregate invariant and persists one effect for
  duplicate or concurrent execution.
- A retry with the same key and payload returns an equivalent payment view; the
  same key with a different payload returns a deterministic conflict.
- Queries return a dedicated payment view without loading an aggregate merely
  to display state.
- Payment refers to a WordPress-owned order by stable federated identifier and
  never writes WordPress storage directly.

## Checkout and payment flow

The composed graph exposes owner operations while the Java contexts react by
strict RabbitMQ choreography rather than a central saga coordinator:

1. the buyer opens the Gateway subscription endpoint backed by the Java Transaction context;
2. through Gateway, the buyer uses the native cart/checkout mutation and obtains
   the WordPress-owned order identifier;
3. through Gateway, the buyer executes the Payment Federation command with that
   order reference and an operation key;
4. Transaction, Inventory, and Payment exchange versioned integration events over RabbitMQ;
5. Transaction publishes authorized order transitions to the open SSE
   subscription, and the final federated query returns the same state.

Gateway does not become a workflow engine, no context accesses another
context's database, and no central saga coordinator owns the lifecycle.

## Failure and compensation

- A rejected payment leaves the WooCommerce order in an allowed unpaid/failed
  state and does not consume stock twice.
- A refund is an idempotent Payment command; the related commercial cancellation
  is an authorized WordPress operation.
- Retrying either owner operation with the same key is safe.
- An interrupted client can query both owner states and resume the missing
  explicit operation without guessing from a local Commerce workflow copy.
- State transitions are monotonic within each owner; stale retries do not
  regress terminal state.

This design does not claim an atomic transaction across PostgreSQL and
WordPress. It makes the boundary visible and testable without installing a
generic distributed saga.

## Choreographed event design

Transaction, Inventory, and Payment communicate only with versioned RabbitMQ
integration events. Each context persists its own outbox/inbox boundary and
reacts independently; Axon records durable, replayable context state.

## GraphQL-over-SSE subscription

Logical contract:

```graphql
type Subscription {
  orderEvents(operationKey: ID!): OrderEvent!
}
```

- Payment Federation hosts the GraphQL subscription; Gateway proxies the SSE transport.
- Axon subscription queries isolate updates by authenticated owner and transaction.
- Authentication succeeds before stream resources are reserved.
- Events are filtered by authenticated subject and operation key; another
  buyer's key does not reveal whether an order exists.
- The subscription can open before checkout and remain active through terminal
  state.
- Cancellation, heartbeat, timeout, backpressure, and cleanup are managed by
  NestJS providers and covered by lifecycle tests.
- The terminal event contains enough state to compare with the federated query.

GraphQL SSE `text/event-stream` remains distinct from Apollo Router multipart
HTTP. No runtime relabels one protocol as the other.

## Acceptance scenarios

- sequential and concurrent repeats of one payment key persist one effect;
- reuse of a key with a different payload fails deterministically;
- native checkout does not create duplicate commercial effects on supported
  retries, or a focused compatibility test documents the exact missing gap;
- invalid scope or ownership is rejected independently by WordPress and Payment;
- payment failure/refund and commercial cancellation remain idempotent;
- a subscription opened before checkout receives authorized transitions through
  terminal state and releases resources on cancellation;
- the stream, federated query, and Apollo MCP operation observe equivalent final
  state.

## Deliberate omissions

There is no Node Order Workflow runtime, separate Stock worker, generic saga
framework, distributed command bus, or central coordinator. Payment Federation
is the sole Java deployment owner, and Gateway owns only the authenticated SSE transport.

## Executable evidence

- `test/federated-platform-refactor.test.mjs` locks this PRD to ADR 007 and
  verifies that deliberately omitted abstractions are documented.
- `test/architecture-boundaries.test.mjs` keeps framework, persistence,
  WordPress, and messaging implementations outside domain/application code.
- Payment command/query tests prove invariants, transaction scope, read views,
  and duplicate/concurrent idempotency.
- WordPress federation tests prove delegation to native commercial behavior;
  subscription tests prove schema reuse, auth, filtering, cancellation, and
  cleanup outside Gateway.
- The final end-to-end gate compares stream, federated query, and MCP results.

## Sources

- [WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [WPGraphQL for WooCommerce](https://github.com/wp-graphql/wp-graphql-woocommerce)
- [GraphQL over SSE](https://github.com/enisdenjo/graphql-sse)
