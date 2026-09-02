# Spec: OAuth resource-server authentication

> feature: oauth-resource-server-auth
> status: rascunho

## Context

Better Auth already acts as the OAuth 2.1 authorization server and the Gateway
already verifies access tokens with `verifyAccessTokenRequest`. After that
verification, however, the Gateway replaces the bearer token with unsigned
identity and scope headers protected by one static federation secret. The
Order Workflow, Identity, and Payment subgraphs therefore trust a custom
protocol instead of acting as standard OAuth resource servers. This feature
removes that duplicated trust mechanism from owned services and establishes a
reusable rule: authentication is delegated to the platform-native verifier,
while NestJS and Spring keep only framework integration and domain policy.

## User stories

### US-087 — Preserve OAuth proof across federation boundaries

As a platform operator, I want every owned subgraph to validate the original
access token, so that identity, audience, expiry, and scopes cannot be forged
after the Gateway.

#### AC-174 — Tokens are issued for every owned protected resource

- **Dado** Better Auth configured as the platform authorization server
- **Quando** a Gateway, MCP, Order Workflow, Identity, or Payment token is issued
- **Então** each owned protected resource has an explicit audience and allowed scopes, while WordPress session integration remains outside this OAuth trust model

#### AC-175 — Federation preserves the standard bearer credential

- **Dado** a valid authenticated GraphQL request entering the Gateway
- **Quando** the Gateway calls an owned subgraph
- **Então** it forwards the bearer credential and request correlation data without manufacturing `x-authenticated-subject`, `x-authenticated-scopes`, or a shared federation secret

### US-088 — Reuse native resource-server integration in NestJS

As a NestJS maintainer, I want one injectable OAuth guard and typed decorators,
so that subgraphs share verification without sharing domain authorization.

#### AC-176 — NestJS resource servers use Better Auth verification

- **Dado** the shared NestJS authentication module
- **Quando** Identity or Order Workflow receives GraphQL or HTTP traffic
- **Então** an injectable guard uses Better Auth `verifyAccessTokenRequest`, exposes typed verified claims in the execution context, and metadata-driven scope guards remain reusable by resolvers

### US-089 — Use Spring Security at the Java boundary

As a Payment Federation maintainer, I want Spring to validate OAuth tokens, so
that Java does not reimplement JWT, JWKS, issuer, audience, or expiry checks.

#### AC-177 — Payment is a standard Spring OAuth resource server

- **Dado** the Payment GraphQL federation endpoint
- **Quando** a bearer token reaches the Java runtime
- **Então** Spring Security validates signature, issuer, audience, expiry, and required scopes before GraphQL business code, with no static federation-secret interceptor

### US-090 — Keep streaming authentication equivalent to GraphQL

As a buyer, I want subscriptions to use the same OAuth proof as queries and
mutations, so that an alternate transport cannot bypass authentication.

#### AC-178 — SSE validates the same bearer token

- **Dado** the Gateway and Order Workflow SSE path
- **Quando** a subscription connection is opened
- **Então** the standard bearer credential is verified through the shared resource-server service and the verified subject owns the stream

### US-091 — Turn native-first integration into a maintained rule

As a reviewer, I want custom infrastructure code justified consistently, so
that future work checks framework and product capabilities before inventing a
protocol or lifecycle abstraction.

#### AC-179 — Native-first boundaries are documented and executable

- **Dado** the Better Auth migration as a reference implementation
- **Quando** architecture documentation and quality tests are inspected
- **Então** they require native security/configuration/lifecycle facilities first, record any remaining custom gap, and prevent the removed identity-header protocol from returning

## Out of scope

- Replacing WooCommerce cookies, cart tokens, or WordPress service credentials.
- Adding token exchange or an external service mesh.
- Moving business ownership checks from their bounded contexts into Better Auth.
- Creating a generic security framework independent of NestJS and Spring.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-063 | Better Auth JWT access tokens can carry all explicitly requested/default resource audiences required by the federated request. | confirmed | The OAuth Provider resource configuration already controls JWT `aud`; owned subgraphs will be registered explicitly. |
| ASM-064 | Forwarding the original bearer token is acceptable inside the private federation network without token exchange. | confirmed | The token remains audience-bound, short-lived, TLS-protected in production, and independently verified at every owned resource. |
| ASM-065 | WordPress cannot become a Better Auth resource server without custom plugin work. | confirmed | Its native session/service authentication remains isolated and is not treated as proof of Better Auth identity. |

## Perguntas em aberto

None.
