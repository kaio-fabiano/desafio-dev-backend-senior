# Spec: Structural improvement program

> feature: structural-improvement-program
> status: em-implementacao

## Context

The platform has reached its target topology, but each active structure now needs a focused correctness, security, maintainability, and over-engineering review. Improvements must preserve public behavior, reduce unnecessary complexity, and leave executable evidence instead of subjective cleanup claims.

## User stories

### US-060 — Maintainable active platform structures

As a platform maintainer, I want every active application and shared structure reviewed and improved independently, so that defects and accidental complexity are removed without destabilizing the complete marketplace journey.

#### AC-121 — Gateway remains a thin and secure edge

- **Dado** the Apollo Gateway HTTP, federation, authentication, and SSE boundaries
- **Quando** its structure is reviewed and the accepted findings are fixed
- **Então** authentication is verified once, WordPress origin propagation remains scoped, subscriptions delegate to Commerce, and the Gateway owns no business workflow

#### AC-122 — Identity keeps one authorization authority

- **Dado** the Better Auth OAuth provider, identity subgraph, and persistence adapters
- **Quando** their structure is reviewed and the accepted findings are fixed
- **Então** token verification, audience and scope enforcement, identity linking, and persistence ownership remain explicit and free of duplicate authorization paths

#### AC-123 — Commerce keeps deterministic workflow ownership

- **Dado** checkout, order persistence, RabbitMQ choreography, outbox delivery, and GraphQL subscriptions
- **Quando** their structure is reviewed and the accepted findings are fixed
- **Então** Commerce remains the single workflow and subscription authority with idempotent event handling and no transport logic in its domain core

#### AC-124 — Payment keeps reliable isolated adapters

- **Dado** payment authorization, inventory reaction, persistence, RabbitMQ delivery, and direct WPGraphQL integration
- **Quando** their structure is reviewed and the accepted findings are fixed
- **Então** retries and acknowledgements remain reliable, service authentication is isolated, and payment and inventory domain behavior does not depend on transport details

#### AC-125 — WordPress bootstrap stays minimal and reproducible

- **Dado** the pinned WordPress, WooCommerce, WPGraphQL, federation, and headless-login integration
- **Quando** its bootstrap and Compose structure are reviewed and the accepted findings are fixed
- **Então** one reproducible setup exposes the native federated subgraph without restoring a custom Node.js proxy or redundant plugin code

#### AC-126 — MCP exposes only least-privilege operations

- **Dado** the Apollo MCP operation registry and Gateway client
- **Quando** their structure is reviewed and the accepted findings are fixed
- **Então** only approved operations are exposed, every operation has an explicit scope, and MCP preserves GraphQL identity parity

#### AC-127 — Shared platform and infrastructure stay dependency-safe

- **Dado** shared NestJS libraries, Nx boundaries, Compose, and deployment configuration
- **Quando** their structure is reviewed and the accepted findings are fixed
- **Então** reusable infrastructure remains outside domain cores, active projects have valid dependency boundaries, and retired runtimes cannot re-enter builds or deployment

#### AC-128 — End-to-end evidence matches the improved topology

- **Dado** the complete active topology and its architecture documentation
- **Quando** all structural improvements are integrated
- **Então** focused tests, the real containerized journey, documentation, and the architecture review record describe and prove the same behavior

## Out of scope

- New marketplace capabilities or public GraphQL operations.
- Framework, database, broker, or authentication-provider replacement.
- Reintroducing the removed WordPress federation runtime.
- Cosmetic rewrites without a correctness, security, maintainability, or deletion benefit.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-045 | The review covers every active application and shared platform structure in eight incremental waves. | confirmada | Confirmed by the user on 2026-08-31. |
| ASM-046 | Existing public behavior and acceptance journeys are compatibility constraints. | confirmada | The user approved the proposed review plan, which preserves current behavior. |

## Perguntas em aberto

None.
