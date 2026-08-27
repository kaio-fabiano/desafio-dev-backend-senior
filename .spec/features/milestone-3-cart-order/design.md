# Design: Milestone 3 — Cart and idempotent order

## Scope boundary

WooCommerce owns cart, order, item, price, and commercial status. Commerce owns
only `CheckoutOperation`, `OrderWorkflow`, and `OutboxEvent`. The GraphQL schema
extends the federated WooCommerce `Order`; it does not create a competing order type.

## Checkout flow

1. Derive `subject` from the verified gateway context and read the native Woo cart.
2. Canonicalize `{subject, cart snapshot, payment method}` and hash it.
3. Insert `CheckoutOperation(subject, operationKey, commandHash, PENDING_WOO)`;
   the PostgreSQL unique constraint resolves races.
4. The winner calls WooCommerce with a stable reference derived from the operation.
5. If Woo already has that reference, reuse the existing order.
6. In one local transaction, store `wooOrderId`, create/update `OrderWorkflow`,
   and insert one unsent outbox event.
7. A retry with the same hash returns the stored order; a different hash conflicts.
8. A `PENDING_WOO` retry queries Woo by the stable reference before creating anything.

## Persistence boundary

MikroORM mappings live under Commerce infrastructure. Request handlers use an
isolated request context; reconciliation/worker entry points create their own
context. Better Auth tables are not MikroORM entities. The initial migration is
explicit and versioned; tests apply it to a clean PostgreSQL database.

## Federation boundary

Cart mutations delegate to the native Woo API under the authenticated subject.
`User.orders` remains owned by the WordPress/catalog subgraph. Commerce resolves
`Order.workflow` by `wooOrderId`, and request-scoped loaders batch those lookups.
The acceptance query travels through the gateway and joins User → Order →
OrderWorkflow → OrderItem → Product.

## Deliberate deferrals

The outbox publisher, RabbitMQ topology, Java payment processor, saga transitions,
and SSE subscription are not required to prove this milestone and are not scaffolded.
