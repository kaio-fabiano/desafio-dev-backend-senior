# Spec: GraphQL-only WooCommerce integration

> feature: graphql-only-woocommerce
> status: auditada

## Context

The WordPress integration already uses WPGraphQL for identity, catalog, cart,
checkout, payment, and inventory, but order reconciliation and two operational
checks still call WooCommerce REST. The pinned WPGraphQL for WooCommerce schema
and the existing order-search compatibility plugin have now been proved to
support the same exact-reference lookup through GraphQL.

## Stories

### US-114 — Use one protocol for every WooCommerce integration

As a maintainer, I want every application and acceptance path to integrate with
WooCommerce through GraphQL so that authentication, errors, and protocol
contracts remain consistent.

#### AC-241 — Reconcile checkout orders through GraphQL

- **Dado** a checkout operation that may already have created a WooCommerce order
- **Quando** Order Workflow searches for the stable operation reference
- **Então** it executes a named authenticated GraphQL query against `/graphql`, validates an exact metadata match, and never calls the WooCommerce REST orders collection.

#### AC-242 — Remove WooCommerce REST credentials and operational calls

- **Dado** the application topology and acceptance journey
- **Quando** WordPress readiness, stock setup, and service credentials are inspected
- **Então** WooCommerce API traffic uses GraphQL and the topology no longer provisions or injects WooCommerce REST consumer keys.

#### AC-243 — Preserve idempotent checkout recovery

- **Dado** a successful, missing, malformed, ambiguous, or failed remote order lookup
- **Quando** checkout creation or reconciliation runs
- **Então** the existing exact-reference, error, snapshot, and duplicate-prevention behavior remains unchanged.

## Out of scope

- Replacing WordPress CLI commands used inside the WordPress container.
- Adding a custom GraphQL field, endpoint, table, or persistence model.
- Changing the public federated commerce schema or checkout behavior.

## Suposições

| ID      | Assumption                                                                                                                                                                           | Status     | Resolution                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ASM-080 | The pinned WPGraphQL for WooCommerce `orders(where: { search })` query uses the existing WooCommerce order-search hooks and returns the workflow metadata needed for an exact match. | confirmada | A live authenticated proof on 2026-09-05 created an order, queried its unique workflow reference through GraphQL, validated metadata and line items, and deleted the fixture. |
| ASM-081 | “Everything through GraphQL” applies to application and acceptance HTTP integration; internal WordPress CLI bootstrap remains allowed.                                               | confirmada | The user explicitly requested a GraphQL-only WooCommerce integration; WP CLI is not a REST integration.                                                                       |

## Perguntas em aberto

| ID    | Question                                                                         | Status     | Answer                                                                                                 |
| ----- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Q-017 | Which model, effort, and execution order should be fixed for the migration task? | respondida | The user requested the fastest possible execution on 2026-09-05: gpt-5.6-luna, low effort, sequential. |
