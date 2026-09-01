# Spec: Milestone 0 — Compatibility proofs

> feature: marco-0-pocs
> status: auditada

## Context

Before building the final services, the project must prove that the integrations
underpinning the architecture work together at the pinned versions. The proofs
must be small, reproducible, and sufficient to decide the design of the
gateway, multi-resource authentication, and WordPress federation.

## Stories

### US-004 — Reproducible proof harness

As a developer, I want to run the proofs through the Nx workspace so that a
clean clone exposes the same projects, targets, and results.

#### AC-008 — Workspace installs and recognizes the proofs

- **Dado** a clean clone with Node, pnpm, and Docker available
- **Quando** dependencies are installed and Nx projects are queried
- **Então** installation finishes without blocked builds and the workspace exposes an executable test target for the proofs

### US-005 — Federated SSE transport proven

As the GraphQL architecture owner, I want to validate `graphql-sse` through the
gateway and a Federation v2 subgraph to decide the final design without
confusing SSE with Apollo's multipart protocol.

#### AC-009 — Event crosses gateway and subgraph through SSE

- **Dado** a Federation v2 subgraph and proof gateway running
- **Quando** a `graphql-sse` client opens a subscription and the subgraph publishes an event
- **Então** the client receives the event through the gateway with `text/event-stream` transport

#### AC-010 — Compatibility failure produces a reproducible decision

- **Dado** that the required transport may not be directly supported by the evaluated gateway
- **Quando** the subscription proof is executed
- **Então** the test passes through the integration or records a verifiable limitation with the smallest alternative design

### US-006 — Multi-resource token proven

As the security owner, I want to validate a token issued by Better Auth at the
gateway and Apollo MCP to guarantee strict audience and scopes at both resource
servers.

#### AC-011 — The same grant serves gateway and MCP

- **Dado** seeded clients and distinct resources for gateway and Apollo MCP
- **Quando** the client requests both audiences and uses the access token on both resources
- **Então** gateway and MCP accept the token after verifying issuer, audience, validity, and scopes

#### AC-012 — Missing audience is rejected

- **Dado** an access token that does not list the accessed resource's audience
- **Quando** it is presented to the gateway or Apollo MCP
- **Então** the resource rejects the request without implicitly expanding audience or scope

### US-007 — Plugin-first WordPress federation proven

As the catalog owner, I want to test the indicated WordPress plugins first to
reuse WooCommerce types, Connections, and mutations without creating a
speculative wrapper.

#### AC-013 — WordPress composes into the supergraph

- **Dado** WordPress with WPGraphQL, WPGraphQL for WooCommerce, and `wp-graphql-federations` at pinned versions
- **Quando** the schema is composed as Federation v2
- **Então** `Product` and `Order` have resolvable keys and composition completes without error

#### AC-014 — Critical Woo capabilities have evidence

- **Dado** the composed WordPress subgraph
- **Quando** Connections, batching, and an ownership-protected mutation are exercised
- **Então** Relay pagination works, calls are batched, and a vendor cannot change another vendor's product

### US-008 — Milestone 0 decisions remain auditable

As the delivery owner, I want versions and conclusions recorded in ADRs so that
the monorepo foundation uses only proven paths.

#### AC-015 — Every proof closes a decision with evidence

- **Dado** the results of the three compatibility proofs
- **Quando** Milestone 0 is completed
- **Então** ADRs record versions or commits, reproduction commands, evidence, and the adopted decision

#### AC-016 — Delivery constraints remain explicit

- **Dado** that the README requires SST v3 and states a deadline of 08/07/2026 at 12:00 BRT
- **Quando** delivery constraints are consulted
- **Então** the SST version and confirmed interpretation of the deadline appear in the decision record

## Out of scope

- Implementing the final marketplace services.
- Creating a WordPress wrapper before the plugin-first proof demonstrates a gap.
- Implementing saga, cart, payment, inventory, deployment, or observability.
- Obtaining production coverage or performance from proof code.

## Suposições

| ID      | Assumption                                                                      | Status     | Resolution                                                        |
| ------- | ------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| ASM-003 | PoCs may live in isolated projects and be replaced by the final implementation. | confirmada | The roadmap defines Milestone 0 as a proof before the final apps. |
| ASM-004 | Docker and Docker Compose are available for local proofs.                       | confirmada | Environment verified with Docker 29.7.2 and Compose 5.5.0.        |
| ASM-005 | SST must remain pinned to the v3 line until explicit authorization to migrate.  | confirmada | The README explicitly requires SST v3.                            |

## Perguntas em aberto

| ID    | Question                                                             | Status     | Answer                                                                                       |
| ----- | -------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Q-002 | Has the 08/07/2026 at 12:00 BRT deadline passed, or was it extended? | respondida | The owner confirmed 2026-09-03 as a date-only deadline, with no time or timezone commitment. |
