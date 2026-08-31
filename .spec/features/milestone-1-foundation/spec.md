# Spec: Milestone 1 — Monorepo foundation and contracts

> feature: milestone-1-foundation
> status: auditada

## Context

Milestone 0 proved the risky integrations. The project now needs the smallest
production-shaped Nx foundation that preserves those decisions and gives later
vertical slices stable service, GraphQL, event, and local-infrastructure
contracts.

## Stories

### US-009 — Audited baseline remains trustworthy

As a maintainer, I want the completed compatibility milestone and constitution
checks to reflect the repository so that later audits start from a truthful
baseline.

#### AC-017 — Previous milestone is closed without an inert secret check

- **Dado** the Milestone 0 acceptance proofs have passed
- **Quando** the project status and constitution are audited
- **Então** Milestone 0 is marked as audited and the secret scan checks the JavaScript and TypeScript source trees that actually exist

### US-010 — Nx boundaries are explicit

As a developer, I want generated projects to carry stable scope and type tags so
that domain and application boundaries fail fast during development.

#### AC-018 — Invalid cross-domain imports are rejected

- **Dado** the gateway, identity, commerce, contract, and shared project groups
- **Quando** Nx validates project tags and module-boundary rules
- **Então** allowed dependencies pass and a fixture containing a forbidden cross-domain import fails

### US-011 — Service skeletons expose operational state

As an operator, I want the initial gateway and subgraphs to distinguish liveness
from readiness so that orchestration does not route traffic to an unready app.

#### AC-019 — Skeleton services report health and readiness

- **Dado** the gateway, identity subgraph, and commerce subgraph skeletons are running
- **Quando** their health and readiness endpoints are requested
- **Então** health succeeds immediately and readiness succeeds only after the service initialization check passes

### US-012 — GraphQL ownership composes before implementation

As a GraphQL client developer, I want versioned identity, catalog, and commerce
contracts to compose so that entity ownership is fixed before resolvers are
built.

#### AC-020 — The Milestone 1 supergraph composes

- **Dado** versioned Federation v2 SDLs for identity, WordPress catalog, and commerce
- **Quando** Rover composes the checked-in supergraph configuration
- **Então** composition succeeds with the documented User, SupplierCompany, Product, Order, and CheckoutOperation ownership and keys

### US-013 — Events share one versioned envelope

As an event consumer, I want every domain event to use the same validated
envelope so that retries, tracing, and schema evolution have stable fields.

#### AC-021 — Valid events pass and malformed events fail

- **Dado** the common event envelope and the initial checkout event schemas
- **Quando** representative valid and malformed payloads are validated
- **Então** valid payloads preserve event identity, version, occurrence time, trace context, and operation key while malformed payloads are rejected

### US-014 — A clean clone starts the foundation

As a reviewer, I want one local harness to compose contracts and start healthy
skeletons so that the foundation is reproducible outside the author's machine.

#### AC-022 — Local infrastructure becomes ready

- **Dado** Docker and the repository dependencies are available in a clean clone
- **Quando** the Milestone 1 harness starts the required infrastructure and applications
- **Então** dependency readiness is checked by behavior rather than open ports and every skeleton reaches ready state

#### AC-023 — One command proves the foundation gate

- **Dado** a clean clone with no generated build artifacts
- **Quando** the documented Milestone 1 verification command runs
- **Então** Nx discovers the projects, the supergraph composes, contract tests pass, and the healthy skeleton gate exits successfully

## Out of scope

- Better Auth user flows, WordPress registration, and production authorization.
- Cart, checkout, payment, inventory, saga, SSE delivery, and Apollo MCP behavior.
- A custom catalog wrapper; Milestone 0 adopted the plugin-first path.
- Production deployment, load testing, and observability exporters.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-006 | Gateway, identity, and commerce skeletons use the repository's required NestJS/Node stack. | confirmada | README sections 2, 3, and 18 require NestJS in the gateway and identity service and place these apps in the Nx monorepo. |
| ASM-007 | The catalog contract is checked in as SDL but no custom catalog app is created. | confirmada | ADR 003 adopts the WordPress plugins with only schema-publication normalization. |
| ASM-008 | The Milestone 1 harness may use the standard library for app probes and reserve Testcontainers for dependency readiness. | confirmada | The roadmap requires a basic Testcontainers harness; using it only where containers exist keeps the gate minimal. |

## Perguntas em aberto

Nenhuma.
