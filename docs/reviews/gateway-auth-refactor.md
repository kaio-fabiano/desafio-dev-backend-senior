# Gateway Authentication Hardening Review

## Purpose

This ledger records the resolved review findings for the NestJS GraphQL
gateway. Task `T-184` implemented them under `AC-226`; behavioral evidence is
recorded in `docs/evidence/node-review/T-184.md`.

Primary scope:

- `libs/gateway/nest/src/auth/auth-context.factory.ts`
- `libs/gateway/nest/src/auth/token-verifier.service.ts`
- `libs/gateway/nest/src/federation/authenticated-data-source.ts`
- `libs/gateway/nest/src/gateway.module.ts`

The gateway is an OAuth resource server. Better Auth issues credentials through
the identity service, while gateway verification, GraphQL context construction,
and federated credential propagation remain separate responsibilities.

## High priority

### Resolved 1 — Use idiomatic NestJS decorators

Replace decorator function calls with `@Injectable()` and constructor
injection. Do not use `@Inject()` when the class itself is the DI token.

**Status:** Resolved. Providers now use decorators and constructor injection;
explicit class-token injection remains for the tsx runtime, which does not emit
constructor type metadata.

### Resolved 2 — Separate authentication from the gateway context

Split the flat `AuthContext` into an authentication principal and a gateway
context containing request metadata, commerce session headers, and response
header access.

**Status:** Resolved. `AuthenticationPrincipal` contains verified identity and
claims while `GatewayContext` owns request, session, and response state.

### Resolved 3 — Centralize session header constants

Define runtime `as const` request and response header lists and derive their
types. Do not introduce an enum for string header names.

**Status:** Resolved. Runtime lists and their derived types live in
`auth/gateway-context.ts`.

### Resolved 4 — Preserve non-authentication failures

Map only missing or invalid credentials to GraphQL `UNAUTHENTICATED`. Do not
mask JWKS outages, configuration errors, timeouts, or bugs as HTTP 401. Provide
one centralized GraphQL authentication error helper.

**Status:** Resolved. Only typed OAuth and stable JOSE credential errors become
`UNAUTHENTICATED`; JWKS provider, configuration, network, and unknown failures
retain their original error.

### Resolved 5 — Use a trusted request base URL

Do not construct security-sensitive URLs from an unvalidated `Host` header.
Use a configured internal gateway origin or an explicit trusted-proxy policy.

**Status:** Resolved. `GATEWAY_ORIGIN` supplies an HTTP(S) origin; absolute,
network-path, and backslash-based request-target overrides are rejected.

### Resolved 6 — Allowlist forwarded cookies

Forward only the cookies proven necessary for WordPress or WooCommerce and
document that allowlist. Do not forward the complete client cookie header by
default.

**Status:** Resolved. Only WooCommerce cart hash, item count, and prefixed
session cookies are accepted.

## Medium priority

### Resolved 7 — Extract the Fetch Request adapter

Move `IncomingMessage` to Fetch `Request` conversion out of the authentication
context factory and keep one shared implementation for its actual callers.

**Status:** Resolved. `auth/gateway-request.adapter.ts` is shared by GraphQL and
SSE authentication.

### Resolved 8 — Place reusable context types deliberately

Move types shared by authentication and federation to a small common context
module without creating trivial files or circular imports.

**Status:** Resolved. The principal, context, session types, runtime constants,
and cookie filter share one cohesive context module.

### Resolved 9 — Remove or isolate compatibility middleware

Find every caller of `createGatewayAuthMiddleware`. Delete it if unused;
otherwise isolate the non-Nest adapter and reuse verification logic without
manually constructing NestJS services.

**Status:** Resolved. The unused compatibility export was removed and its MCP
propagation harness now exercises `AuthContextFactory`.

### Resolved 10 — Keep all GraphQL operations private

Document whether `/graphql` always requires authentication. Keep fail-fast
context creation if it is private; otherwise make the principal optional and
authorize protected operations explicitly.

**Status:** Resolved. `/graphql` remains private and context creation continues
to authenticate before operation execution.

### Resolved 11 — Preserve multiple `Set-Cookie` values

Use the response Headers API supported by the installed Apollo Gateway stack to
capture every `Set-Cookie` value, with a regression test for multiple cookies.

**Status:** Resolved. Apollo's installed `Headers.raw()` API is preferred, with
native and scalar fallbacks; response writes append values across subrequests.

## Federation data source

### Resolved 12 — Replace subgraph names with propagation policies

Make `AuthenticatedDataSource` execute explicit capabilities such as bearer,
session, response-session, and origin forwarding. Keep subgraph names in
gateway composition, not infrastructure code.

**Status:** Resolved. Gateway composition assigns immutable explicit
capabilities and the data source contains no subgraph-name branching.

### Resolved 13 — Propagate request IDs independently

Forward `x-request-id` whenever available, including an anonymous request if
anonymous operations are approved. Observability must not depend on a subject.

**Status:** Resolved. Correlation IDs propagate whenever present, independently
of the principal or bearer capability.

### Resolved 14 — Make bearer propagation opt-in

Forward `Authorization` only when the destination policy explicitly allows it.
No subgraph should receive a bearer token by default.

**Status:** Resolved. Bearer forwarding defaults off and requires a destination
capability.

## Token verification

### Resolved 15 — Prove JWKS caching and rotation

Verify that normal token checks use cached keys and that an unknown or rotated
`kid` triggers a controlled refresh instead of an HTTP request per operation.

**Status:** Resolved. The full-path integration spec proves cached verification
and controlled refresh after key rotation.

### Resolved 16 — Validate OAuth and JWT claims completely

Prove signature, issuer, audience, expiry, optional not-before, subject, key ID,
and normalized scopes. Reject validly signed tokens for another issuer or
audience.

**Status:** Resolved. Platform verification and gateway integration specs cover
signature, issuer, audience, expiry, not-before, subject, key ID, and scopes.

### Resolved 17 — Restrict accepted JWT algorithms

Configure the accepted algorithms rather than trusting the token's `alg`
header.

**Status:** Resolved. Both the gateway header boundary and shared resource
verifier accept ES256 only.

## Required tests

### Resolved 18 — Test `AuthContextFactory`

Cover valid, invalid, and missing tokens; preserved internal failures; request
ID and session extraction; response headers; trusted URL construction; and Host
header injection attempts.

**Status:** Resolved. Focused unit and adapter specs cover each listed branch,
including internal failures and origin override attempts.

### Resolved 19 — Test `AuthenticatedDataSource`

Cover each forwarding capability, session allowlists, response session capture,
multiple cookies, and request ID propagation.

**Status:** Resolved. Focused data-source specs exercise each capability,
allowlist, repeated-cookie path, and correlation behavior.

### Resolved 20 — Test the complete gateway path

Cover client to gateway to token verification to context to data source to
subgraph, including wrong audience, wrong issuer, expiry, bearer/session
propagation, response session capture, and correlation IDs.

**Status:** Resolved. The integration spec runs a signed credential through the
resource verifier, context factory, Apollo data source, and HTTP subgraph.

## Completed execution order

1. Fixed decorators and dependency injection.
2. Separated the principal, gateway context, and header constants.
3. Centralized authentication errors and extracted request conversion.
4. Established a trusted base URL and cookie allowlist.
5. Replaced subgraph-name branching with explicit policies.
6. Corrected request ID, bearer, and multi-cookie propagation.
7. Removed the compatibility middleware.
8. Audited JWKS caching, claims, and algorithms against Better Auth 1.7.1.
9. Added unit and integration coverage.

## Constraints

- Preserve GraphQL contracts and Apollo Gateway compatibility.
- Keep the documented private GraphQL authentication decision explicit.
- Preserve distinct OAuth audiences and fail closed at resource boundaries.
- Prefer NestJS dependency injection over manual service construction.
- Apply least privilege to credentials, cookies, and headers.
- Avoid speculative abstractions, unnecessary enums, and excessive file splits.
