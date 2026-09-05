# ADR 003: Use the native plugin-first WordPress federation schema

- Status: accepted for implementation
- Date: 2026-08-26
- Decision owner: catalog architecture

## Context

The platform must preserve WordPress and WooCommerce as the commercial system
of record while participating in Apollo Federation v2. WPGraphQL, GraphQL for
eCommerce, and `wp-graphql-federations` already expose the graph, native Relay
Connections, request loaders, mutations, and WordPress authorization checks.
A second Node runtime would duplicate that boundary.

## Pinned proof

| Component                | Version or commit                          |
| ------------------------ | ------------------------------------------ |
| WordPress                | `6.8.2-php8.3-apache`                      |
| WooCommerce              | `10.4.3`                                   |
| WPGraphQL                | `2.20.0`                                   |
| GraphQL for eCommerce    | `1.0.3`                                    |
| WPGraphQL Headless Login | `0.4.4`                                    |
| `wp-graphql-federations` | `ac480974ceb6a1680410f955005e060056f150da` |
| Rover                    | `0.41.0`                                   |
| Federation composition   | `2.15.2`                                   |

Reproduce from the repository root:

```bash
bash apps/wordpress-integration/scripts/install-plugins.sh
node apps/wordpress-integration/scripts/probe.mjs
node --test --test-reporter=tap test/marco-0-wordpress.test.mjs
```

The local and CI bootstrap validates the installed plugin version before using
the pinned source URL. It reuses an exact match and downloads only a missing or
mismatched plugin. Production must use a prebuilt immutable WordPress image
containing these pinned plugins and must not download plugins at startup.
Plugin upgrades therefore require an explicit version change, image rebuild,
and successful composition proof before deployment.

## Evidence

The probe sends the plugin's `_service.sdl` to Rover and exercises the native
WordPress endpoint. It proves Relay pagination, batched `_entities` resolution
through WPGraphQL's deferred loader, and WooCommerce ownership enforcement.
Historical compatibility experiments around the shared `Product` interface are
retained as evidence, but do not justify a permanent schema-publication proxy.

## Decision

Use the WordPress installation's native `/graphql` endpoint as the external
Federation v2 subgraph. Configure supported `@key`, `@external`, and `@requires`
directives through `wp-graphql-federations` and capture that configuration in
reproducible bootstrap and composition evidence.

Do not build a NestJS proxy, duplicate the WooCommerce schema, or introduce an
SDL-normalization runtime. Any plugin compatibility gap must be resolved with
reproducible plugin configuration, an upstream-compatible plugin version, or a
future decision backed by a failing composition test.

WPGraphQL Headless Login remains responsible for the WordPress session model.
Payment transitions use authenticated provider APIs. Commerce owns order
event publication, and Gateway exposes the authenticated GraphQL-over-SSE edge.
WordPress does not own a second subscription implementation.

Identity registration uses the same native `/graphql` boundary directly. The
pinned schema supplies `registerCustomer`, `updateCustomer`, `deleteUser`, and
Headless Login's `SITETOKEN` provider, so registration does not require the
WooCommerce REST customer API, a NestJS proxy, or a custom WordPress mutation.
A dedicated `identity_registrar` role owns only `read`, `list_users`,
`edit_users`, and `delete_users`; its linked service identity obtains a
short-lived bearer token through the site-token provider. These administrative
operations are service-internal and are not added to the normalized public
supergraph contract.

One private compatibility plugin is retained for Order Workflow idempotency.
WPGraphQL's authenticated root `orders(where: { search })` query uses
WooCommerce search semantics but arbitrary metadata is not searched by
default. The plugin adds only
`_order_workflow_operation_reference` to WooCommerce's official legacy and HPOS
search filters. It creates no route, schema field, table, or authentication
mechanism; reconciliation uses the native GraphQL query with a short-lived
service bearer token obtained through the `SITETOKEN` provider. The plugin must be included in the immutable
WordPress image and reviewed whenever WooCommerce changes either search hook.
Order creation explicitly selects WooCommerce's enabled native `cod` offline
gateway because the financial method and lifecycle are owned by Payment
Federation; this satisfies WooCommerce checkout validation without introducing
a second payment processor or a custom WooCommerce gateway.

No marketplace MU-plugin, custom GraphQL field, custom inventory route, custom
REST route, or custom WordPress authentication filter is retained. The native
identity registration operations and their least-privilege setup are proved by
`test/wordpress-registration-graphql.contract.test.mjs`.
