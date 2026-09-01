# Spec: Production happy path hardening

> feature: production-happy-path-hardening
> status: auditada

## Context

The purchase happy path works in one process but keeps cart sessions, order coordination, inventory effects, and subscription replay partially in memory. It must remain correct after retries, restarts, and horizontal scaling while using native GraphQL Federation, NestJS, PostgreSQL, RabbitMQ, and WooCommerce mechanisms.

## Stories

### US-063 — Keep the buyer cart portable

As a buyer, I want my WooCommerce cart session to follow federated requests so that checkout works independently of the Commerce replica handling it.

#### AC-131 — Cart survives replica changes

- **Dado** a buyer adds products through the WordPress-owned federated mutation
- **Quando** checkout is handled by another Commerce process
- **Então** the same WooCommerce cart is read without process-local cart state

#### AC-132 — WordPress owns cart mutations

- **Dado** WPGraphQL for WooCommerce exposes cart operations
- **Quando** the buyer changes the cart through the supergraph
- **Então** WordPress performs the mutation and Commerce does not duplicate it

### US-064 — Create one recoverable WooCommerce order

As a buyer, I want retries of the same checkout to resolve to one order so that network failures and concurrent requests never duplicate a purchase.

#### AC-133 — Checkout converges on one order

- **Dado** concurrent or recovered attempts use the same operation key
- **Quando** WooCommerce creation succeeds, times out, or is retried
- **Então** every successful response identifies the same WooCommerce order

### US-065 — Apply inventory transitions once

As an operator, I want inventory reactions to survive consumer failure so that redelivery cannot repeat an untracked external stock effect.

#### AC-134 — Inventory recovery is durable

- **Dado** an inventory event is delivered more than once or processing stops mid-flight
- **Quando** the consumer resumes
- **Então** durable state reconciles the WooCommerce transition before acknowledging it

### US-066 — Observe order progress across replicas

As a buyer, I want order progress subscriptions to reconnect anywhere so that events are not lost when a process restarts or another replica serves SSE.

#### AC-135 — Subscription state is replayable

- **Dado** an order workflow has progressed or reached a terminal state
- **Quando** a subscriber connects or reconnects to any replica
- **Então** it receives the latest authorized state and subsequent transitions

### US-067 — Preserve framework-aligned quality

As a maintainer, I want each correction reviewed against the final architecture so that NestJS, Federation, and object boundaries are used deliberately.

#### AC-136 — Every correction passes its quality loop

- **Dado** a task changes production code
- **Quando** the task is considered complete
- **Então** focused tests, applicable ESLint targets, and a code-review pass succeed

#### AC-137 — Dependencies point toward application contracts

- **Dado** resolvers, consumers, and application services need authentication, persistence, messaging, or WooCommerce capabilities
- **Quando** their NestJS modules are composed
- **Então** business code depends on explicit ports and injection tokens while concrete adapters remain replaceable infrastructure providers

## Out of scope

- Replacing GraphQL-over-SSE with federated subscriptions; Apollo Federation does not support subscriptions.
- Introducing event sourcing or the in-memory `@nestjs/cqrs` saga runtime.
- Replacing WooCommerce as the cart, order, or inventory authority.
- Adding infrastructure when PostgreSQL or RabbitMQ already provides the needed primitive.
- Creating a generic shared abstraction before at least two real consumers require the same semantics.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-049 | The WordPress subgraph exposes the WooGraphQL `addToCart` mutation. | confirmada | Present in the composed WordPress schema. |
| ASM-050 | A stable WooCommerce order reference can be reconciled after an ambiguous REST result. | confirmada | T-103 persists the stable reference and reconciles it before retrying creation. |
| ASM-051 | A persisted workflow snapshot plus cross-replica notification closes the SSE replay gap. | confirmada | T-105 replays versioned PostgreSQL state and reconnects streams through transactional notifications. |
| ASM-052 | WooCommerce inventory transitions can be queried before retrying an external effect. | confirmada | T-104 persists the operation claim and reconciles the WooCommerce inventory state before retry. |

## Perguntas em aberto

None requiring product-owner input. Technical assumptions are executable proofs inside their owning tasks.
