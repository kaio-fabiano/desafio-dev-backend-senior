# ADR 006: Reconcile WooCommerce checkout by a stable operation reference

- Status: accepted for implementation
- Date: 2026-08-27
- Decision owner: commerce architecture

## Context

WooCommerce 10.4.3 is the commercial order system of record, while Commerce
stores only checkout operation and workflow metadata. A remote order can be
created before the local transaction records its identifier. Retrying the
remote create blindly would duplicate that order.

The pinned WooCommerce REST orders endpoint accepts order metadata but does not
offer a native exact filter for arbitrary metadata. The GraphQL plugins expose
checkout and orders, but do not close this create-or-find gap either.

## Decision

Commerce assigns every reserved checkout operation a unique `wooReference`.
The adapter writes it to the order metadata key
`_commerce_operation_reference`, scans paginated WooCommerce orders for an
exact match before creation, and exposes the same lookup for reconciliation.
Sequential retries therefore return the existing commercial order. The local
unique operation constraint and checkout service remain responsible for
preventing concurrent callers from reaching remote creation together.

The reference is integration metadata, not a customer identity or a copy of
the order. Credentials are supplied at runtime and the adapter uses the native
WooCommerce REST API without another dependency.

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

Reconciliation scans pages because the pinned API cannot filter arbitrary
metadata exactly. If production order volume makes that scan material, add a
minimal WordPress endpoint that performs the same exact metadata lookup; keep
the metadata key and adapter contract unchanged.
