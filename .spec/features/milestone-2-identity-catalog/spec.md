# Spec: Milestone 2 — Identity and federated catalog

> feature: milestone-2-identity-catalog
> status: pronta

## Context

The foundation composes static contracts but does not yet identify callers or
serve catalog data through the public graph. This milestone delivers the
smallest production-shaped identity and catalog slice: Better Auth issues and
validates tokens, `me` is derived from the token, registration links WordPress,
supplier ownership is enforced, and native WooCommerce Connections are batched
through the federated gateway.

## Stories

### US-015 — A client obtains a verifiable marketplace token

As a marketplace client, I want the authorization server metadata, keys, and
seeded client to be reproducible so that I can authenticate without manual
database setup.

#### AC-024 — OAuth metadata and client seed are reproducible

- **Dado** a clean identity database and the pinned application configuration
- **Quando** the identity service starts and the seed runs twice
- **Então** discovery and JWKS are available and exactly one gateway client exists

### US-016 — Protected resources reject invalid callers

As an operator, I want tokens validated against the expected issuer, audience,
validity, and scopes so that forged or misdirected credentials fail closed.

#### AC-025 — Invalid token claims are rejected

- **Dado** validly signed tokens with an expired lifetime, wrong issuer, wrong audience, or insufficient scope
- **Quando** each token calls a protected gateway operation
- **Então** every request is rejected without accepting identity headers supplied by the caller

### US-017 — An authenticated user queries their own identity

As a signed-in user, I want `me` to resolve from my access token so that another
caller cannot select my identity through arguments or headers.

#### AC-026 — A valid token resolves `me`

- **Dado** a valid gateway token for a known user
- **Quando** the caller queries `me` through the federated gateway
- **Então** the returned user matches the token subject

#### AC-027 — Caller input cannot replace the authenticated user

- **Dado** a valid token and a conflicting user identifier supplied by the caller
- **Quando** the caller queries `me`
- **Então** the returned user still matches the token subject

### US-018 — Registration creates one consistent cross-system identity

As a new user, I want registration to link my email identity to WordPress so
that I do not receive an account that works in only one system.

#### AC-028 — Registration links email and WordPress accounts

- **Dado** valid registration data and an available WordPress identity endpoint
- **Quando** the user signs up
- **Então** one identity exists with both email and WordPress accounts

#### AC-029 — A failed WordPress link leaves no usable partial account

- **Dado** valid registration data and a failing WordPress identity endpoint
- **Quando** the user signs up
- **Então** login is unavailable until the identity is compensated or reconciled

### US-019 — Supplier ownership cannot be crossed

As supplier A, I want supplier B blocked from changing my products so that
company ownership survives membership and user changes.

#### AC-030 — A different supplier is rejected

- **Dado** a product owned by supplier A and a caller belonging to supplier B
- **Quando** supplier B attempts the catalog mutation through the gateway
- **Então** the mutation is rejected and the product remains unchanged

### US-020 — Catalog lists remain stable and bounded

As a catalog client, I want opaque cursor pagination so that I can traverse
products without duplicates or unbounded in-memory reads.

#### AC-031 — Native catalog Connections paginate with opaque cursors

- **Dado** more products than one requested page
- **Quando** the client follows `endCursor` through the federated gateway
- **Então** consecutive pages contain distinct products and correct `PageInfo`

### US-021 — Federated references do not create N+1 calls

As an operator, I want request-scoped batching measured per request so that a
larger result set does not multiply catalog calls by orders and items.

#### AC-032 — Federated entity loads are batched per request

- **Dado** a federated query containing multiple product references
- **Quando** the query runs with data-source counters enabled
- **Então** references are loaded in one ordered batch and a later request uses a fresh loader

## Out of scope

- Cart creation, idempotent order creation, payments, inventory, SSE, and MCP tools.
- A NestJS catalog proxy or a reimplementation of native WooCommerce types.
- DPoP and machine-to-machine delegated user scopes.

## Suposições

None. The token audience strategy and plugin-first WordPress path were already
proved and recorded by Milestone 0 and ADR 003.

## Perguntas em aberto

None. The WordPress failure behavior is selected by executable integration
evidence: compensate when safe; otherwise persist a non-login pending state.
