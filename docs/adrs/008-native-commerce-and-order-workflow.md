# ADR 008: Native commerce and a focused Order Workflow Federation

- Status: accepted
- Date: 2026-09-01
- Decision owner: platform architecture

## Context

WordPress, WooCommerce, WPGraphQL, WooGraphQL, and
`wp-graphql-federations` already publish product, cart, customer, order, and
checkout capabilities. The former Commerce Federation repeated parts of those
contracts and forwarded requests to WooCommerce. Forwarding alone does not give
a service an independent lifecycle or invariant.

The delivery still requires behavior that those products do not provide as one
unit: a durable idempotency claim spanning checkout and payment, a
RabbitMQ-choreographed saga, transactional inbox/outbox records, and an
ownership-protected SSE stream that may be opened before checkout.

## Decision

Use the native WordPress GraphQL subgraph for catalog, cart, customer orders,
and the authoritative WooCommerce order. Rename Commerce Federation to Order
Workflow Federation and limit it to checkout operation claims, technical saga
state, inbox/outbox, reconciliation, and order-event delivery.

Order Workflow invokes WooGraphQL's native `checkout` mutation. It stores its
operation reference in WooCommerce order metadata so a retry can reconcile an
ambiguous response without creating another order. Its GraphQL contract extends
the federated `Order` only with workflow-owned fields; it does not republish
product, cart, customer, order connection, or line-item models.

## Alternatives considered

- Keep Commerce as a general facade: rejected because it duplicates a mature
  API, increases schema drift, and owns no additional commercial invariant.
- Remove Commerce entirely: rejected because WooCommerce does not own the
  distributed idempotency claim, choreographed lifecycle, or pre-checkout SSE
  ownership required by this delivery.
- Move workflow into Payment: rejected because an order lifecycle spans payment
  and inventory and is not part of the financial aggregate.
- Add a custom WordPress plugin: rejected because WooGraphQL checkout metadata
  is sufficient for correlation and reconciliation.

## Consequences and removal condition

There is one less duplicate API and WooCommerce remains the commercial system
of record. Order Workflow remains a deployable because it owns durable state and
a lifecycle of its own. It introduces an explicit dependency on the pinned
WooGraphQL checkout contract and must test that contract during upgrades.

Order Workflow can be removed only when an adopted platform provides the same
durable cross-participant idempotency, inbox/outbox choreography, reconciliation,
and authenticated pre-checkout event stream with equivalent acceptance tests.
