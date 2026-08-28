# Spec: Federated platform architecture refactor

> feature: federated-platform-architecture-refactor
> status: pronta

## Context

The working proof of concept demonstrates the required marketplace journey, but
framework composition, persistence, and business behavior currently live inside
application bootstrap files and ad-hoc factories. Identity duplicates Better
Auth persistence access, the gateway contains catalog loaders and a subscription
proxy, and commerce/payment/inventory responsibilities are split across more
runtimes than the intended federated architecture.

This refactor preserves the proven behavior while converging on five deployable
applications: Apollo MCP, Gateway, Identity Federation, Payment Federation, and
WordPress Federation. Domain logic belongs to the context that owns it; NestJS
and Spring dependency injection compose providers at the application boundary.

## Histórias

### US-046 — Explainable bounded contexts

As a technical evaluator, I want each runtime to have one documented business
responsibility so that I can understand why the technology and boundary exist.

#### AC-090 — Only the intended deployable applications remain

- **Dado** the refactored Nx project graph
- **Quando** deployable applications are enumerated
- **Então** only Apollo MCP, Gateway, Identity Federation, Payment Federation, WordPress Federation, and the end-to-end test project remain

#### AC-091 — Architectural dependencies follow context boundaries

- **Dado** the target application and library graph
- **Quando** architectural dependency tests run
- **Então** domain and application code do not depend on NestJS, GraphQL, persistence adapters, WordPress clients, or messaging implementations

### US-047 — Native NestJS composition

As a maintainer, I want NestJS runtimes composed from modules and providers so
that dependencies, lifecycle, configuration, and tests are managed by the
framework rather than bootstrap singletons.

#### AC-092 — NestJS owns runtime dependencies

- **Dado** Gateway and Identity Federation startup
- **Quando** their Nest application contexts are created
- **Então** configuration, authentication, plugin factories, adapters, and lifecycle resources resolve through registered providers without constructing infrastructure in `main.ts`

#### AC-093 — Better Auth uses its NestJS integration

- **Dado** Identity Federation authentication and OAuth plugins
- **Quando** the Identity module is initialized
- **Então** `NestJSBetterAuth` and one injectable factory per configured Better Auth plugin create the auth runtime and expose its framework-managed handler

#### AC-094 — Identity does not duplicate Better Auth persistence

- **Dado** Identity queries and registration flows
- **Quando** users, accounts, sessions, and OAuth clients are accessed
- **Então** the Better Auth APIs and models are used without a custom PostgreSQL user repository or a second ORM mapping for those records

### US-048 — Thin authenticated federation gateway

As a federated GraphQL client, I want one authenticated graph entry point so
that the gateway composes subgraphs without owning business data or query logic.

#### AC-095 — Gateway contains only edge responsibilities

- **Dado** the Gateway module and request pipeline
- **Quando** a federated request is processed
- **Então** the gateway verifies identity, propagates authenticated context, composes the supergraph, and contains no catalog loader, business repository, commerce client, or subscription proxy

#### AC-096 — Subgraphs enforce sensitive authorization

- **Dado** a valid or invalid propagated identity
- **Quando** a protected Identity, Payment, or WordPress operation is executed
- **Então** its owning federation rejects missing scopes or ownership independently of gateway validation

### US-049 — WordPress-owned commerce federation

As a marketplace client, I want catalog, cart, order, and inventory behavior
exposed from their authoritative WooCommerce source so that the platform does
not maintain competing commercial models.

#### AC-097 — WordPress plugins provide the commercial graph

- **Dado** WPGraphQL, WPGraphQL for WooCommerce, and the federation integration
- **Quando** the WordPress subgraph SDL is published and composed
- **Então** native product, cart, order, customer, and inventory capabilities are reused and only tested capability gaps receive custom plugin code

#### AC-098 — Commerce and stock runtimes are retired safely

- **Dado** checkout, inventory, and order status acceptance scenarios
- **Quando** they execute through the composed graph
- **Então** their observable behavior is provided by WordPress Federation and Payment Federation without deploying the former Commerce subgraph or Stock worker

### US-050 — Spring Payment federation with focused DDD and CQRS

As a marketplace client, I want payment commands and payment views exposed as a
federated graph so that payment invariants remain isolated and independently
testable in the Spring runtime.

#### AC-099 — Payment is a Spring GraphQL Federation subgraph

- **Dado** the Spring Boot Payment application
- **Quando** its federation SDL is composed
- **Então** payment mutations, queries, and entity references are served through Spring for GraphQL Federation and participate in the supergraph

#### AC-100 — Payment write and read paths are explicit

- **Dado** an idempotent payment command and a payment query
- **Quando** their handlers execute
- **Então** the command enforces aggregate invariants inside one transaction while the query returns a dedicated view without loading an aggregate unnecessarily

#### AC-101 — Payment delivery remains idempotent

- **Dado** duplicate or concurrent deliveries for one payment operation
- **Quando** Payment processes authorization, Pix generation, or compensation
- **Então** one payment effect is persisted and retries return an equivalent result without regressing state

### US-051 — Standards-based real-time order updates

As an authenticated buyer, I want to subscribe to my order transitions through
a documented GraphQL subscription endpoint so that real-time delivery does not
depend on custom gateway transport code.

#### AC-102 — NestJS manages the subscription lifecycle

- **Dado** an authenticated order subscription
- **Quando** it opens, receives transitions, or is cancelled
- **Então** a `graphql-sse` handler uses the executable schema produced by the NestJS Apollo application while NestJS providers manage authentication, filtering, cleanup, and delivery outside the federation gateway

### US-052 — Reviewable technical challenge

As a technical evaluator, I want executable architecture checks and concise
decision records so that every major technology choice can be demonstrated and
defended.

#### AC-103 — Quality gates explain and enforce the design

- **Dado** the completed refactor
- **Quando** project quality, architecture, composition, unit, integration, and end-to-end gates run
- **Então** they pass and the documentation maps each runtime, provider boundary, domain decision, and deliberately omitted abstraction to executable evidence

## Out of scope

- AWS deployment or production infrastructure rollout.
- Event sourcing, Axon Server, or a distributed command bus.
- Reimplementing Better Auth, WooCommerce, WPGraphQL, or Spring GraphQL features.
- Adding MikroORM when no NestJS bounded context owns first-party relational data.
- A generic DDD framework, generic repository, or application-wide base service hierarchy.
- Changing user-visible marketplace behavior beyond what is required to move ownership.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-032 | The accepted final topology contains Apollo MCP, Gateway, Identity Federation, Payment Federation, and WordPress Federation; Commerce and Stock are retired. | confirmada | Confirmed by the user before this specification was created. |
| ASM-033 | WordPress Federation remains plugin-first; a NestJS wrapper is allowed only after a failing compatibility test proves a gap. | invalidada | The user selected a thin NestJS WordPress Federation application after requesting validation against the official WPGraphQL documentation. Native WPGraphQL and WooGraphQL behavior must still be delegated rather than reimplemented. |
| ASM-034 | Better Auth remains the sole owner of its internal persistence schema and no Identity MikroORM model mirrors it. | confirmada | Confirmed by the accepted architecture direction. |
| ASM-035 | CQRS is applied to behavior-rich Payment use cases and other contexts only when separate read/write paths reduce real complexity. | confirmada | Confirmed by the accepted selective-CQRS direction. |

## Perguntas em aberto

| ID | Question | Status | Answer |
|---|---|---|---|
| Q-004 | Should the NestJS-managed order subscription preserve the challenge's GraphQL-over-SSE transport, or adopt the `graphql-ws` transport demonstrated by the NestJS subscription documentation? | respondida | Preserve GraphQL-over-SSE. Reuse the executable schema created by NestJS Apollo through `GraphQLSchemaHost` and attach the official `graphql-sse` handler after application initialization. |
| Q-005 | Is WordPress Federation a NestJS application that delegates native WPGraphQL/WooGraphQL capabilities and owns the subscription endpoint, or is WordPress itself the direct federated subgraph? | respondida | Use a thin NestJS WordPress Federation application that delegates native WPGraphQL/WooGraphQL capabilities and owns the subscription endpoint. |
