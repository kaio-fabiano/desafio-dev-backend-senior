# Spec: Strict NestJS DDD migration

> feature: strict-nestjs-ddd-migration
> status: rascunho

## Contexto

The repository already documents bounded contexts and an inward dependency
direction, but the stable NestJS platform, Gateway, and Identity code still
mixes classes, interfaces, type aliases, constants, and functions in the same
production files. Several repositories also colocate application ports and
infrastructure adapters.

The migration must establish a strict, mechanically enforced DDD development
contract suitable for many teams and coding agents. It must improve boundaries
without changing public GraphQL, HTTP, SSE, OAuth, messaging, or persistence
behavior during structural migration.

## Histórias

### US-118 — Give every contributor one mandatory DDD contract

As an engineering lead, I want one canonical DDD standard referenced by agent
instructions and executable project principles, so that humans and agents make
the same architectural decisions.

#### AC-252 — The strict DDD contract is explicit

- **Dado** a contributor is about to design or change production behavior
- **Quando** the contributor reads the repository development contract
- **Então** the contract defines strategic design, bounded-context ownership, aggregate boundaries, dependency direction, class and file rules, naming, allowed exceptions, and the required test layers

#### AC-253 — Agents cannot silently bypass the contract

- **Dado** an agent receives an implementation task
- **Quando** it follows `AGENTS.md` and the project constitution
- **Então** it must identify the bounded context, use case, aggregate or explicit absence of one, invariants, consistency boundary, and affected ports before changing production code

### US-119 — Enforce one production responsibility per TypeScript file

As a maintainer, I want class-first files with no colocated declarations, so
that ownership, navigation, review, and automated refactoring remain predictable.

#### AC-254 — Mixed production declarations fail mechanically

- **Dado** a production class file containing an additional top-level class, interface, type alias, enum, function, or runtime constant
- **Quando** the architecture test runs
- **Então** it fails with the file and forbidden declaration identified

#### AC-255 — Framework exceptions are narrow and auditable

- **Dado** Node.js or NestJS requires a functional artifact such as bootstrap, a custom decorator, generated code, a migration, or a barrel
- **Quando** the architecture test evaluates that file
- **Então** only the explicitly documented dedicated-file exception is accepted and no service, controller, resolver, provider, module, domain, or application class receives an exception

### US-120 — Keep DDD code independent from NestJS

As a domain developer, I want domain and application classes independent from
the framework, so that business rules and use cases remain portable and directly
testable.

#### AC-256 — Dependency direction remains inward

- **Dado** a source file under a domain or application layer
- **Quando** its imports and decorators are inspected
- **Então** it imports no NestJS, GraphQL, ORM, transport, adapter, or other bounded context internals, while application code depends on domain classes and abstract port classes only

#### AC-257 — Tactical DDD building blocks use focused classes

- **Dado** a new entity, aggregate, value object, domain event, domain service, use case, command, query, DTO, error, mapper, port, or adapter
- **Quando** it is added to production code
- **Então** it is represented by one focused class in its own role-named file, with ports represented by abstract classes and aggregate invariants protected by aggregate methods

### US-121 — Migrate the stable NestJS contexts without behavior drift

As a platform owner, I want the stable Platform, Gateway, and Identity NestJS
contexts migrated in safe waves, so that strict enforcement is reached without
a disruptive rewrite or investment in a transitional order workflow.

#### AC-258 — Every migration wave preserves contracts

- **Dado** the current platform, gateway, and identity behavior
- **Quando** a bounded-context migration wave is completed
- **Então** its unit, integration, contract, and relevant end-to-end tests remain green and its legacy architecture allowlist strictly shrinks

#### AC-259 — The migration closes with zero legacy exceptions

- **Dado** all in-scope Platform, Gateway, and Identity migration waves are complete
- **Quando** the full quality and architecture gates run
- **Então** no in-scope legacy file remains allowlisted and build, typecheck, lint, tests, coverage, specification verification, and CI audit all pass

## Fora de escopo

- Changing public API schemas, authentication semantics, event schemas, or database schemas solely to satisfy file organization.
- Introducing a generic DDD framework, base entity, base repository, command bus, event sourcing, or CQRS without a concrete domain requirement.
- Refactoring `apps/order-workflow-subgraph`; its checkout, idempotency, saga,
  queue, and order responsibilities are transitional and will be replaced by a
  separate design in which WooCommerce remains the cart/order source of truth
  and post-checkout business processing belongs to Java.
- Refactoring the Java Payment bounded context or WordPress-owned code in this
  TypeScript/NestJS migration; their future changes belong to that separate
  checkout/order redesign.
- Converting tests to one class per file; the rule applies to production code.

## Suposições

| ID | Suposição | Status | Resolução |
| --- | --- | --- | --- |
| ASM-085 | “Classes always” applies without exception to domain and application production artifacts, while framework-required functional artifacts may exist only in dedicated, explicitly approved outer-layer files. | confirmada | The owner accepted narrow functional exceptions provided they never cross or mix architectural layers. |
| ASM-086 | The current GraphQL, HTTP, OAuth, SSE, RabbitMQ, and persistence contracts must remain behaviorally compatible throughout the migration. | confirmada | The request is architectural; no behavior change was requested. |
| ASM-087 | Existing uncommitted milestone 7 and Compose changes are unrelated and must not be modified by this feature. | confirmada | The initial worktree inspection found those pre-existing changes. |
| ASM-088 | The current TypeScript Order Workflow is intentionally excluded because its ownership and behavior will change: WooCommerce will retain cart/order capabilities and the remaining workflow will move to Java. | confirmada | The owner explicitly removed Order Workflow from this NestJS migration to avoid refactoring disposable behavior. |
| ASM-089 | The six migration tasks run sequentially with T-209 on `gpt-5.6-luna` at low effort and T-210, T-211, T-212, T-213, and T-216 on `gpt-5.6-terra` at medium effort. | confirmada | The owner explicitly accepted the recommended execution order, models, and efforts before execution. Headless task sessions must not request this confirmation again. |
| ASM-090 | T-216 may replace only the two legacy Platform callable API usages inside Order Workflow with their class-based equivalents. | confirmada | The owner explicitly authorized this narrow mechanical compatibility migration after the zero-baseline gate proved it was required. Checkout, order, idempotency, saga, queue, persistence, and payment behavior remain excluded. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
| --- | --- | --- | --- |
| Q-018 | Should dedicated NestJS/Node functional artifacts remain allowed where the framework API is inherently functional, or must they be wrapped in classes even when that adds adapter ceremony? | respondida | Allow only the narrow dedicated-file exceptions in AC-255, confined to presentation, infrastructure, composition, or bootstrap; domain and application remain framework-independent and class-first. |
