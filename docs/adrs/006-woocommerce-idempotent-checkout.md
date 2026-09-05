# ADR 006: Reconcile WooCommerce checkout by a stable operation reference

- Status: accepted for implementation
- Date: 2026-08-27
- Decision owner: commerce architecture

## Context

WooCommerce 10.4.3 is the commercial order system of record, while Commerce
stores only checkout operation and workflow metadata. A remote order can be
created before the local transaction records its identifier. Retrying the
remote create blindly would duplicate that order.

The pinned WooGraphQL schema exposes checkout and authenticated root order
search. WooCommerce does not search arbitrary order metadata by default, so the
existing compatibility plugin adds the operation-reference key to its legacy
and HPOS search hooks.

## Decision

Commerce assigns every reserved checkout operation a unique `wooReference`.
The adapter writes it to the order metadata key
`_order_workflow_operation_reference`, queries
`orders(where: { search: reference })`, and validates the metadata value for an
exact match before creation. It exposes the same lookup for reconciliation.
Sequential retries therefore return the existing commercial order. The local
unique operation constraint and checkout service remain responsible for
preventing concurrent callers from reaching remote creation together.

The reference is integration metadata, not a customer identity or a copy of
the order. The adapter obtains a short-lived service bearer token through
WPGraphQL Headless Login's `SITETOKEN` provider and uses `/graphql` for both
creation and reconciliation. No WooCommerce REST consumer key is provisioned.

## Evidence

Run the isolated contract proof:

```bash
node --experimental-transform-types --test --test-reporter=tap test/milestone-3-wordpress-checkout.test.mjs
```

Run the live proof after bootstrapping the pinned WordPress stack:

```bash
bash apps/wordpress-integration/scripts/install-plugins.sh
node --experimental-transform-types apps/wordpress-integration/scripts/probe-checkout.mjs
```

The probe creates one order, retries with the same reference, reconciles it by
reference, asserts that all identifiers match, and removes its temporary order
and WordPress Application Password.

## Consequences

Reconciliation delegates candidate filtering to the native root order search
and then verifies the metadata value exactly. The compatibility plugin remains
small and contains no endpoint or schema extension.
