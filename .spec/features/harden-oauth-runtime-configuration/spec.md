# Spec: Harden OAuth runtime configuration

> feature: harden-oauth-runtime-configuration
> status: rascunho

## Contexto

The presentation review found configuration drift, premature environment reads,
an OAuth verifier with two responsibilities, incomplete DPoP deployment wiring,
and Identity queries that expose personal data too broadly. These gaps must be
closed without changing the delivered Bearer-token contract.

## Histórias

### US-140 — Keep OAuth verification consistent at runtime

As an operator, I want Identity and Gateway to resolve OAuth configuration at
provider creation time with compatible defaults, so locally loaded environment
configuration cannot silently produce tokens that Gateway rejects.

#### AC-305 — Resolve compatible issuer configuration after Nest config loading

- **Dado** Identity and Gateway start without an explicit OAuth issuer, or load one through Nest configuration
- **Quando** their authentication providers are created
- **Então** both use the same HTTP issuer default and Gateway honors the value loaded by `ConfigModule`

### US-141 — Enforce production-safe DPoP verification

As a security operator, I want every production Gateway instance to validate
DPoP against the public request URI and one shared replay store, so a proof
cannot be accepted with the wrong `htu` or reused against another instance.

#### AC-306 — Reserve DPoP proof identifiers atomically across instances

- **Dado** two Gateway verifier instances use the same configured replay table
- **Quando** both attempt to reserve the same DPoP replay key
- **Então** exactly one reservation succeeds and the duplicate is rejected

#### AC-307 — Deploy canonical origin and shared replay storage

- **Dado** the production SST stack is synthesized
- **Quando** the Gateway service configuration is inspected
- **Então** `GATEWAY_ORIGIN` is the public API URL and a linked shared replay table with expiry is configured

### US-142 — Give the shared verifier one responsibility per provider

As a platform maintainer, I want request orchestration separated from Better
Auth verification, so dependency injection has one adapter instance and no
service acts as both a port implementation and its own consumer.

#### AC-308 — Separate OAuth orchestration from Better Auth verification

- **Dado** an OAuth resource module configured with issuer, audience, and JWKS
- **Quando** Nest resolves its verifier, use case, request service, and GraphQL guard
- **Então** one Better Auth adapter implements the verifier port and the request service only delegates to the verification use case

### US-143 — Protect Identity user data

As an Identity owner, I want list and point queries to enforce explicit
visibility, so ordinary marketplace tokens cannot enumerate user identifiers
or email addresses.

#### AC-309 — Restrict the user list to an administrative scope

- **Dado** an ordinary delegated token or a token with `identity:users:read`
- **Quando** it requests `users`
- **Então** only the token with the administrative scope may list user identifiers and email addresses

#### AC-310 — Hide other users from point lookup and federation references

- **Dado** an authenticated user without the administrative scope
- **Quando** it requests `user(id)` or resolves a `User` reference for another subject
- **Então** the result is indistinguishable from a missing user, while `me` and self lookup remain available

#### AC-311 — Exercise the production request-scoped batch provider

- **Dado** repeated and distinct Identity lookups in one request and another request
- **Quando** Nest resolves the production `FindIdentityUsersUseCase` provider
- **Então** lookups batch and cache only within one request, with no legacy loader or repository alias

#### AC-312 — Report previous pages from persisted rows

- **Dado** a canonical cursor that does not identify a persisted user
- **Quando** the next user page is read
- **Então** `hasPreviousPage` reflects whether an earlier persisted row exists instead of merely reflecting the presence of `after`

### US-144 — Document the actual federated audience contract

As an OAuth client integrator, I want the setup guidance to name every required
resource audience, so a Gateway token does not fail when federation reaches the
Identity subgraph.

#### AC-313 — Document the Identity audience for federated user operations

- **Dado** the initial OAuth client and presentation guidance
- **Quando** a client prepares a token for Gateway operations that reach Identity
- **Então** the guidance requires both Gateway and Identity resources and describes Bearer as delivered while DPoP requires canonical origin and shared replay state

## Fora de escopo

- Requiring DPoP for every OAuth client; Bearer-token support remains enabled.
- Adding shared DPoP replay storage to Identity, Payment, or Apollo MCP.
- Adding roles or a general-purpose authorization framework.
- Running unrelated end-to-end or whole-system test suites.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-112 | The SST public API URL is the canonical external Gateway origin used in DPoP `htu`. | confirmada | The public API routes `$default` traffic to Gateway and already defines the public OAuth issuer. |
| ASM-113 | Production DPoP hardening in this change applies to the Gateway resource server only. | confirmada | The reported gap and canonical-origin setting are Gateway-specific; other resource servers remain outside scope. |
| ASM-114 | `identity:users:read` is the narrow administrative scope for `users` and cross-user visibility. | aberta | Awaiting user confirmation before execution. |
| ASM-115 | Unauthorized cross-user lookup returns `null`, matching a missing user and avoiding an enumeration oracle. | aberta | Awaiting user confirmation before execution. |

## Perguntas em aberto

Nenhuma.
