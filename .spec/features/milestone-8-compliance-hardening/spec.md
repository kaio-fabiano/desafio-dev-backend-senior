# Spec: Milestone 8 — Challenge compliance and production hardening

> feature: milestone-8-compliance-hardening
> status: auditada

## Context

The repository has verified contracts and domain components, but its final acceptance journey replaces the application services with an in-memory JavaScript simulator. The runnable NestJS modules are incomplete, the Identity SDL omits mandatory queries, and workspace quality commands are not reproducible. This milestone turns the existing slices into the real deployable system required by the challenge without requiring an AWS account.

## User stories

### US-040 — Trust the acceptance evidence

As an evaluator, I want the end-to-end test to execute the delivered application images, so that a green result proves the submitted architecture rather than a parallel simulator.

#### AC-078 — Acceptance uses the production applications

- **Dado** the final Dockerfiles and a clean Docker environment
- **Quando** the end-to-end target starts the marketplace
- **Então** Testcontainers runs the built Gateway, Identity, Commerce, stock worker, payment processor, WordPress, RabbitMQ, databases, and Apollo MCP images without an inline substitute service

#### AC-079 — Public behavior is proven through real protocols

- **Dado** the real application topology started by Testcontainers
- **Quando** the buyer journey executes
- **Então** registration, OAuth, federated GraphQL, RabbitMQ choreography, WooCommerce, GraphQL SSE, and MCP are exercised only through their public network interfaces

### US-041 — Run the mandatory GraphQL and identity surface

As a marketplace client, I want the versioned SDL mounted by runnable subgraphs and composed by the Gateway, so that every mandatory operation is served by the real implementation.

#### AC-080 — Identity exposes the mandatory schema-first API

- **Dado** the versioned Identity SDL and an authenticated request context
- **Quando** a client queries `users`, `user(id)`, or `me`
- **Então** the real Identity subgraph resolves the Relay connection and federated user entity from persisted identity data with authorization applied

#### AC-081 — Gateway composes and executes the supergraph

- **Dado** ready Identity, Commerce, and WordPress federation endpoints
- **Quando** the Gateway starts and receives an authenticated GraphQL operation
- **Então** it serves the composed Federation v2 supergraph, validates Better Auth tokens, and propagates the authenticated subject to subgraphs

#### AC-082 — Supplier ownership protects product mutations

- **Dado** two suppliers and a product owned by one company
- **Quando** the other supplier attempts to update or remove that product
- **Então** the real federated mutation is rejected without changing WooCommerce

### US-042 — Run the distributed order lifecycle

As a buyer, I want the delivered services to process checkout through durable adapters, so that retries, crashes, and concurrent delivery preserve business invariants.

#### AC-083 — Commerce is wired through explicit boundaries

- **Dado** configured PostgreSQL, WooCommerce, RabbitMQ, and request-scoped dependencies
- **Quando** cart, checkout, order, or subscription operations execute
- **Então** presentation delegates to application use cases, domain rules remain framework-free, and infrastructure adapters perform external I/O

#### AC-084 — Workers execute the real choreography

- **Dado** duplicate and concurrent RabbitMQ deliveries
- **Quando** payment and stock workers process an order
- **Então** inbox/outbox and database constraints produce one payment effect, one stock effect, bounded retry, DLQ routing, and the specified compensation

### US-043 — Enforce maintainable and reproducible code

As a maintainer, I want workspace-level quality gates and honest architecture boundaries, so that Clean Code and SOLID are enforced by useful checks rather than decorative layers.

#### AC-085 — Build, typecheck, lint, and test are reproducible

- **Dado** Node, Corepack, and Docker but no globally installed Gradle
- **Quando** the Nx quality target runs from a clean checkout
- **Então** every production project builds, typechecks, lints, and tests successfully using pinned workspace or containerized tools

#### AC-086 — Dependency direction remains clean

- **Dado** the production source tree
- **Quando** architecture tests inspect imports and module wiring
- **Então** domain code imports no NestJS, GraphQL, ORM, HTTP, RabbitMQ, or filesystem implementation and cross-context imports use contracts or explicit ports

#### AC-087 — Obsolete PoC applications leave the production graph

- **Dado** equivalent behavior proven by the real applications
- **Quando** the Nx project graph and runbooks are inspected
- **Então** obsolete auth and SSE PoCs are removed, the empty harness is replaced by proper acceptance targets, and the WordPress integration has a production-oriented name

### US-044 — Review infrastructure without an AWS account

As the repository owner, I want deployment configuration validated without provisioning cloud resources, so that the submission remains reviewable and cost-safe until credentials are intentionally configured.

#### AC-088 — AWS validation is offline and deployment is guarded

- **Dado** no AWS credentials and no configured AWS account
- **Quando** local and pull-request infrastructure checks run
- **Então** SST configuration, types, containers, secrets declarations, and workflow policy are validated without creating resources, while deploy remains an explicitly approved credentialed action

## Out of scope

- Provisioning any AWS resource or requiring AWS credentials.
- Adding abstractions solely to satisfy a pattern name; each port must isolate a real external boundary or support more than one meaningful implementation.
- OpenTelemetry until the mandatory real-system acceptance gate is green; it remains a separate bonus milestone.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-029 | Docker is available for local integration and containerized Java builds. | confirmada | The existing environment and challenge already require Docker and Testcontainers. |
| ASM-030 | Existing domain services and adapters should be completed and wired rather than rewritten. | confirmada | Review found reusable idempotency, saga, outbox, inbox, SSE, OAuth, and WooCommerce components. |
| ASM-031 | SOLID and Clean Architecture constrain dependencies and responsibilities rather than requiring one interface per class. | confirmada | Best practices must remain justified and minimal. |

## Perguntas em aberto

| ID | Question | Status | Answer |
|---|---|---|---|
| Q-003 | Should validation provision AWS resources before an account is configured? | respondida | No. Keep validation offline and deployment guarded until explicitly authorized. |
