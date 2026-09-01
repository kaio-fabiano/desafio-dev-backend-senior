# PRD 03 — Identity, OAuth2, and authorization

## Expected outcome

The identity subgraph owns Better Auth and acts as the OAuth 2.1/OIDC Authorization
Server. Gateway and Apollo MCP validate access tokens as separate resource servers;
`me` derives exclusively from the authenticated identity.

## Components

- Better Auth with OAuth Provider and JWT plugins.
- Official NestJS integration in the identity-subgraph.
- Client/resource client in the gateway according to verified compatibility.
- OAuth/OIDC discovery, JWKS, revocation, and introspection available.
- Idempotent seed of clients and scopes.

In the NestJS integration, the current documentation requires disabling the body
parser so Better Auth can process the raw request. This detail belongs in a
bootstrap test because a global configuration can break GraphQL or webhooks.

## Proposed clients and resources

| Client           | Type                                       | Grants                            | Resource/audience | Minimum scopes                               |
| ---------------- | ------------------------------------------ | --------------------------------- | ----------------- | -------------------------------------------- |
| cliente-e2e      | public or confidential for testing         | authorization_code + PKCE         | gateway           | `openid profile marketplace:read cart:write` |
| apollo-mcp       | public/confidential according to transport | authorization_code + PKCE         | MCP               | `openid mcp:tools cart:write`                |
| internal workers | confidential                               | client_credentials when necessary | internal APIs     | smallest possible set                        |

Client Credentials is enabled only with its own administrative scopes; delegated
user scopes must not automatically authorize machine-to-machine access.

## Token validation

Each resource server validates:

- signature against JWKS with caching and rotation by `kid`;
- exact `iss`, permitted `aud`, `exp`, and `nbf`;
- global and per-operation scopes;
- propagated identity without accepting external user headers;
- fail closed if discovery/JWKS cannot be validated beyond the safe cache.

Better Auth provides access-token verification with `issuer`, `audience`, and
`requiredScopes`. If DPoP is enabled, `jti` replay requires a shared store across
multiple instances; DPoP remains outside the minimum scope until there is a clear need.

## Sign-up and WordPress link

Use case `SignUpUser`:

1. validates the command and creates a Better Auth identity with email/password;
2. creates or links a WordPress user through a `WordPressIdentityPort`;
3. writes the `wordpress` provider account to the Better Auth `accounts` table;
4. publishes `UserRegistered` only after the state is consistent;
5. returns a user with two accounts: `email` and `wordpress`.

A WordPress failure must not silently leave sign-up partially complete. The first
proposal is to compensate for/remove the newly created identity before responding;
if the Better Auth API does not permit safe compensation, persist the
`PENDING_WORDPRESS_LINK` state and prevent functional login until reconciliation.
This must be decided through an integration test, not an assumption.

## Supplier model

- `SupplierCompany` is an aggregate separate from `User`.
- membership has a role and validity period;
- `Product` stores a stable reference to the company, not only to the creating user;
- authorization compares the authenticated `supplierCompanyId` with the product owner;
- membership changes do not accidentally transfer product ownership.

## `users`, `user`, and `me`

- `users` requires a defined administrative scope/role; it must not be public by
  default merely because it appears in the minimum schema.
- `user(id)` applies field and enumeration policy.
- `me` ignores any external `userId` and uses the validated `sub`.
- the user's orders are resolved by the order-workflow-subgraph through federation.

## Required tests

- accessible discovery and JWKS;
- Authorization Code + S256 PKCE works;
- idempotently seeded clients;
- expired token, invalid signature, and incorrect issuer/audience are rejected;
- insufficient scope results in 403;
- sign-up ends with `email` and `wordpress` accounts;
- supplier B does not change supplier A's product;
- `me` never changes user because of a malicious argument/header.

## Decision: the same token in MCP and gateway

The E2E will use a single JWT access token bound to both protected resources by
means of repeated RFC 8707 `resource` parameters. Better Auth models resources
explicitly and controls the reserved `aud` claim; therefore,
`customAccessTokenClaims` will not be used to fabricate audiences.

The token must contain the gateway and MCP audiences. Each resource server will
validate only its own audience, in addition to issuer, validity, and scopes. Apollo MCP
will keep `allow_any_audience: false` and pass the validated token to the gateway.

This capability is confirmed by the current Better Auth documentation, which accepts
repeated resources and binds selected resources to `aud`, and by Apollo MCP
configuration, which accepts a list of audiences. The PoC remains mandatory as
proof of interoperability for the pinned version, not as an architectural decision.

## Sources

- [Better Auth OAuth Provider](https://better-auth.com/docs/plugins/oauth-provider)
- [Better Auth + NestJS](https://better-auth.com/docs/integrations/nestjs)
- [Apollo MCP Authorization](https://www.apollographql.com/docs/apollo-mcp-server/auth)
