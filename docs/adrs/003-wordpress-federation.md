# ADR 003: Normalize the plugin-first WordPress federation schema

- Status: accepted for the proof
- Date: 2026-08-26
- Decision owner: catalog architecture

## Context

Milestone 0 must try WPGraphQL, GraphQL for eCommerce, and
`wp-graphql-federations` before introducing a WordPress wrapper. The proof must
compose WooCommerce entities under Federation v2 and preserve the native Relay
Connections, request loaders, and WordPress authorization checks.

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

## Evidence

The probe first sends the plugin's unmodified `_service.sdl` to Rover. Direct
Federation v2 composition succeeds for the configured concrete Woo product
types and `Order`. The remaining gap is that GraphQL for eCommerce models the
shared `Product` contract as an interface while the federation plugin registers
only object types. The proof therefore adds the same `id` key to that interface
at the schema publication boundary. No Woo field, protocol type, or resolver is
rewritten.

The normalized schema composes with `Product`, its concrete product types, and
`Order` keyed by `id`. The live probe also proves:

- two Relay pages return distinct cursor windows;
- two product representations resolve in one `_entities` request, and MariaDB's
  proof log contains one `wp_posts.ID IN (...)` load for both IDs through the
  plugin's WPGraphQL deferred loader;
- a vendor role with `edit_products` but without `edit_others_products` receives
  a GraphQL mutation error when targeting another vendor's product, and the
  product remains unchanged.

## Decision

Adopt the indicated plugins and keep native WooCommerce Connections, loaders,
mutations, and WordPress capabilities. Add only the deterministic SDL
normalization at the schema publication boundary. Do not build a NestJS proxy
or replicate the WooCommerce schema. Revisit the normalization if a pinned
`wp-graphql-federations` release emits a directly composable Federation v2 SDL.

The runtime uses Headless Login's server-side `SITETOKEN` provider to exchange
the verified Better Auth identity for WordPress and WooCommerce session tokens.
Payment transitions use authenticated WooCommerce REST, and signed
`order.updated` webhooks feed the NestJS SSE publisher. No marketplace
MU-plugin, custom GraphQL field, custom inventory route, or custom WordPress
authentication filter is retained.

For future directive changes, first use the plugin administration screen for
supported `@key`, `@external`, and `@requires` configuration. Capture the applied
configuration in reproducible bootstrap/export evidence and composition tests;
the current proof did not verify that screen and therefore does not claim it can
represent the interface normalization described above.
