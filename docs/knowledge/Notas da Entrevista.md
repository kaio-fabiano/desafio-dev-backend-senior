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

## WordPress PoC Gate

- [ ] install WPGraphQL, WPGraphQL for WooCommerce, and the federation plugin;
- [ ] introspect `Product`, `Order`, cart, checkout, and their Connections;
- [ ] compose the WordPress subgraph with Rover under Federation v2;
- [ ] resolve `Product` and `Order` by `@key` through the gateway;
- [ ] test mutation ownership with propagated identity;
- [ ] count calls and prove the absence of N+1;
- [ ] record any gap before writing a fallback;
- [ ] keep WooCommerce as the authoritative source for the commercial order.

## Decision Rule

Preference: **configure → extend plugin → minimal fork → specific adapter**.
A NestJS wrapper that replicates all of WooCommerce is the last option and requires
evidence that the previous options failed.
