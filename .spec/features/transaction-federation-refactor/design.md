# Design: Native commerce and Order Workflow Federation

## Decision

Transform `commerce-subgraph` into an `order-workflow-subgraph`. Keep the
deployment because it owns state, invariants and a lifecycle absent from both
WooCommerce and Payment. Remove every responsibility that merely forwards or
duplicates a native commerce capability.

## Target topology

1. Gateway: authentication context, federation composition and external SSE.
2. Identity Federation: Better Auth, OAuth and WordPress identity linkage.
3. WordPress federation: authoritative catalog, cart, customer, checkout,
   order and inventory through installed plugins.
4. Order Workflow Federation: operation-key idempotency, Woo order reference,
   saga projection, inbox/outbox and authorized order-event stream.
5. Payment Federation Java: financial aggregate and real-provider port.
6. Inventory module in Java: separate RabbitMQ participant using native
   WooCommerce inventory capabilities.
7. Apollo MCP: curated operations against the supergraph.

## Ownership and dependency rules

- Order Workflow persists only operation, subject, command hash, Woo order ID,
  technical state and event records.
- It delegates cart and checkout behavior to WooGraphQL and returns federated
  WordPress entity references.
- Payment never owns checkout, order lifecycle, saga projection or SSE.
- Inventory never becomes a Payment application-service call; it consumes a
  payment event and publishes its own result.
- Gateway transports streams but does not own workflow state.
- Domain/application layers depend on ports; NestJS, Spring, RabbitMQ,
  WooGraphQL and provider SDKs remain adapters.

## Migration sequence

1. Prove native plugin capabilities and target boundaries with tests.
2. Rename the Commerce deployment and public contract to Order Workflow.
3. Remove cart/order read wrappers and delegate checkout to WooGraphQL.
4. Preserve and simplify operation, idempotency, inbox/outbox and saga state.
5. Preserve the durable authorized SSE stream in Order Workflow.
6. Isolate Payment and Inventory behind RabbitMQ in Java.
7. Introduce the payment-provider port without selecting a vendor yet.
8. Reconnect Gateway, MCP, composition and E2E.
9. Record ADRs and close ESLint, tests, composition, verify and audit.

## Existence test

A service exists only when it owns state, invariants or a lifecycle. Forwarding
requests is insufficient. Order Workflow passes this test through concurrent
idempotency, distributed saga state, inbox/outbox and stream authorization.
