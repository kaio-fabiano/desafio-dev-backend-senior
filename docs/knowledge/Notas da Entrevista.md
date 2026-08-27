---
tags: [entrevista, arquitetura, wordpress, federation, relay]
updated: 2026-08-25
---

# Interview Notes

Return to [[Mapa do Projeto]]. This note preserves verbal guidance that
complements the README and connects [[GraphQL Federation]], [[Subscriptions SSE]],
[[Identidade OAuth2]] and [[Saga e Idempotência]].

## Received Record

### 2026-08-21

- study [GraphQL.org — Federation](https://graphql.org/learn/federation/);
- study [Apollo Federation](https://www.apollographql.com/federation);
- follow the [Relay Cursor Connections Specification](https://relay.dev/graphql/connections.htm);
- evaluate the [wp-graphql-federations](https://github.com/Manuel-Antunes/wp-graphql-federations) plugin;
- use Server-Sent Events;
- integrate WordPress/OAuth2 authentication with Better Auth;
- apply Saga.

### 2026-08-24

- all system tests must go through the federated gateway;
- WordPress already has many built-in capabilities; do not recreate them.

### Clarification from 2026-08-25

All links were indicated as useful. The Relay link and the federation plugin
repository are therefore an explicit part of the technical guidance.

### Guidance received on 2026-08-27

- consider MikroORM because of its NestJS integration;
- write the GraphQL contracts as part of specification before implementation;
- document and evaluate the federation plugin administration screen for adding
  directives such as `@key`, `@external`, and `@requires`;
- use Java/Spring for the payment processor and integrate Gradle through Nx;
- rely on Nx's daemon, task graph, cache, and centralized output before creating
  a custom TUI.

## Implementation Consequences

1. Use WPGraphQL and WPGraphQL for WooCommerce as the starting point for
   products, orders, cart, checkout, Connections, and authorization.
2. Try `wp-graphql-federations` before creating a proxy, ACL, or general wrapper.
3. Pin plugin versions/commits and prove compatibility with Rover.
4. Create custom code only for an observed gap covered by a test.
5. Run functional, cross-domain, and E2E proofs through the gateway; direct calls
   to modules/subgraphs are only for unit tests or diagnostics.
6. Treat Relay as a contract: opaque cursor, `edges`, `PageInfo`, and pagination in
   the datasource, including for lists coming from WordPress.
7. Use MikroORM only for first-party NestJS persistence; Better Auth keeps ownership
   of its internal schema.
8. Keep Java/Gradle in the same Nx task graph and defer a custom TUI until a real
   operational gap is measured.

## WordPress PoC Gate

- [x] install WPGraphQL, GraphQL for eCommerce, and the federation plugin;
- [x] introspect `Product`, `Order`, and their Relay Connections;
- [x] compose the WordPress subgraph with Rover under Federation v2;
- [x] resolve batched `Product` representations by `@key` through the plugin;
- [x] test mutation ownership with a restricted WordPress vendor identity;
- [x] count calls and prove batched loading rather than N+1;
- [x] record the interface-key gap before adding publication-boundary normalization;
- [x] keep WooCommerce as the authoritative source for the commercial order;
- [ ] verify the directive administration screen and capture its configuration in
  reproducible bootstrap/export evidence;
- [ ] extend the vertical gateway proof to cart and checkout in Milestone 3.

## Decision Rule

Preference: **configure → extend plugin → minimal fork → specific adapter**.
A NestJS wrapper that replicates all of WooCommerce is the last option and requires
evidence that the previous options failed.
