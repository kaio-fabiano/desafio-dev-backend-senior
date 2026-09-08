# Spec: Strict NestJS DDD migration

> feature: strict-nestjs-ddd-migration
> status: rascunho

## Contexto

The repository already documents bounded contexts and an inward dependency
direction, but the previous migration only separated top-level declarations in
the Platform, Gateway, and Identity NestJS roots. It did not establish real
domain, application, infrastructure, presentation, and composition boundaries.
For example, Identity registration still colocates orchestration, Better Auth
hooks, WordPress integration, compensation, and transport error translation in
NestJS services.

The migration must establish a strict, mechanically enforced DDD development
contract suitable for many teams and coding agents. It must improve boundaries
without changing public GraphQL, HTTP, SSE, OAuth, messaging, or persistence
behavior during structural migration. Every project-owned source is in scope
for architectural classification and appropriate refactoring except the two
explicitly excluded application roots.

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

### US-122 — Cover the complete repository without false compliance

As an architecture owner, I want every project-owned artifact classified and
every production source evaluated, so that an empty folder convention or a
partial root list cannot report a migration that did not happen.

#### AC-260 — The inventory has only two application exclusions

- **Dado** the repository inventory is generated
- **Quando** applications, libraries, contracts, infrastructure, plugins, scripts, and test tooling are classified
- **Então** every project-owned path is included except `apps/order-workflow-subgraph` and `apps/payment-federation`, with generated dependencies and build outputs ignored rather than treated as source

#### AC-261 — Missing layers cannot produce a false zero

- **Dado** business orchestration remains in an unclassified NestJS service outside a `domain` or `application` folder
- **Quando** the architecture gate runs
- **Então** it fails because every in-scope production file must belong to an approved context, layer, or technical boundary and dependency direction is checked from that classification

### US-123 — Build a real Identity clean core

As an Identity maintainer, I want registration, provisioning, and identity
rules separated from NestJS, Better Auth, GraphQL, and WordPress, so that core
behavior is independently testable and adapters can change safely.

#### AC-262 — Identity domain and application are framework-independent

- **Dado** an Identity domain or application class
- **Quando** its responsibilities and imports are inspected
- **Então** it contains identity rules or one use-case orchestration responsibility and imports no NestJS, GraphQL, Better Auth, WordPress, database, HTTP, or concrete adapter code

#### AC-263 — Identity adapters implement explicit ports

- **Dado** Better Auth, WordPress, database, GraphQL, or NestJS participates in an Identity flow
- **Quando** the flow is composed
- **Então** each vendor integration is an outer adapter implementing an application abstract-class port, endpoints delegate to use cases, and transport error mapping stays outside domain and application

### US-124 — Separate edge policy from framework plumbing

As a Gateway and Platform maintainer, I want authentication and federation
policy separated from NestJS transport and composition, so that edge behavior
remains secure without inventing fake business aggregates.

#### AC-264 — Platform authorization policy has an inward dependency direction

- **Dado** OAuth claims, required scopes, credential verification, or request authentication behavior
- **Quando** the Platform library is migrated
- **Então** policy and application orchestration are framework-independent while guards, decorators, request conversion, and provider wiring remain NestJS adapters

#### AC-265 — Gateway remains a thin edge context

- **Dado** HTTP, GraphQL federation, cookies, JWT validation, or SSE subscription behavior
- **Quando** Gateway is migrated
- **Então** presentation delegates to focused application classes and ports, concrete clients remain adapters, composition roots only wire dependencies, and Order Workflow is referenced only through its public boundary without modifying the excluded application

### US-125 — Apply architecture appropriate to every other project artifact

As a repository maintainer, I want non-NestJS code included without forcing it
into fictional NestJS or DDD layers, so that the whole repository has explicit
and enforceable ownership.

#### AC-266 — The WordPress integration follows WordPress and WooCommerce boundaries

- **Dado** the project-owned WordPress/WooCommerce plugin and its runtime scripts
- **Quando** they are refactored
- **Então** bootstrap and hooks are thin, responsibilities are isolated in namespaced classes, inputs and capabilities are validated, WooCommerce CRUD APIs remain HPOS-compatible, and WooCommerce remains the cart/order source of truth

#### AC-267 — Technical boundaries remain technical

- **Dado** Apollo MCP declarations, shared schemas, infrastructure configuration, deployment scripts, or end-to-end tooling
- **Quando** they are classified or changed
- **Então** they have explicit ownership, validation, dependency rules, and focused files appropriate to their platform without speculative aggregates, repositories, use cases, or wrapper classes

### US-126 — Prove the repository-wide migration

As an engineering lead, I want executable evidence for every migration wave,
so that completion means clean boundaries rather than renamed files.

#### AC-268 — Each wave uses characterization-first TDD

- **Dado** an in-scope runtime behavior is moved across boundaries
- **Quando** its migration task executes
- **Então** a focused characterization or architecture test fails first, the minimum boundary change makes it pass, and the relevant unit, integration, contract, and end-to-end suites remain green after refactoring

#### AC-269 — Completion has no unclassified production code or legacy baseline

- **Dado** all corrective migration waves are complete
- **Quando** repository quality, architecture, specification, and audit gates run
- **Então** every in-scope production artifact is classified, no legacy architecture allowlist remains, coverage and all relevant tests pass, and `onp-spec verify` plus `onp-spec audit --ci` report success

## Fora de escopo

- Changing public API schemas, authentication semantics, event schemas, or database schemas solely to satisfy file organization.
- Introducing a generic DDD framework, base entity, base repository, command bus, event sourcing, or CQRS without a concrete domain requirement.
- Refactoring `apps/order-workflow-subgraph`; its checkout, idempotency, saga,
  queue, and order responsibilities are transitional and will be replaced by a
  separate design in which WooCommerce remains the cart/order source of truth
  and post-checkout business processing belongs to Java.
- Refactoring `apps/payment-federation`; it is a Java/Spring application and is
  governed by a separate architecture effort. Shared contracts at its boundary
  remain in scope for compatibility verification.
- Converting tests to one class per file; the rule applies to production code.
- Applying NestJS file grammar to declarative GraphQL/JSON/YAML, generated
  sources, shell scripts, PHP, or JavaScript test tooling. These artifacts are
  still inventoried and governed by platform-appropriate rules.

## Suposições

| ID | Suposição | Status | Resolução |
| --- | --- | --- | --- |
| ASM-085 | “Classes always” applies without exception to domain and application production artifacts, while framework-required functional artifacts may exist only in dedicated, explicitly approved outer-layer files. | confirmada | The owner accepted narrow functional exceptions provided they never cross or mix architectural layers. |
| ASM-086 | The current GraphQL, HTTP, OAuth, SSE, RabbitMQ, and persistence contracts must remain behaviorally compatible throughout the migration. | confirmada | The request is architectural; no behavior change was requested. |
| ASM-087 | Existing uncommitted milestone 7 and Compose changes are unrelated and must not be modified by this feature. | confirmada | The initial worktree inspection found those pre-existing changes. |
| ASM-088 | The current TypeScript Order Workflow is intentionally excluded because its ownership and behavior will change: WooCommerce will retain cart/order capabilities and the remaining workflow will move to Java. | confirmada | The owner explicitly removed Order Workflow from this NestJS migration to avoid refactoring disposable behavior. |
| ASM-089 | The original six-task plan used one sequential execution with the previously approved models and efforts. | invalidada | The corrective repository-wide scope introduced a new task set whose models, efforts, and parallelism received a new explicit confirmation. |
| ASM-090 | The original T-216 could mechanically update two Platform API usages inside Order Workflow. | invalidada | The corrected scope excludes the entire Order Workflow application without exceptions; compatibility is maintained from the in-scope provider/contract side. |
| ASM-091 | The corrective migration includes all project-owned code except `apps/order-workflow-subgraph` and `apps/payment-federation`. | confirmada | The owner explicitly corrected the scope: Order Workflow is deferred, Payment is Java and excluded from this NestJS effort, and everything else must be architecturally reviewed and refactored where necessary. |
| ASM-092 | DDD tactical patterns are required only where business concepts and invariants exist; technical edges must use Clean Architecture boundaries without invented aggregates. | confirmada | Strict architecture means explicit ownership and inward dependencies, not ceremonial domain objects around bootstrap, configuration, schemas, or test harnesses. |
| ASM-093 | The four current uncommitted Identity file changes belong to the owner and must be preserved during planning and migration. | confirmada | Worktree inspection found changes in Better Auth and registration files before this corrective plan was edited. |
| ASM-094 | T-216 through T-224 run sequentially with the models and efforts declared in `tasks.md`. | confirmada | The owner explicitly answered “Y” after reviewing the corrective task, model, and effort table and the recommendation for sequential execution. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
| --- | --- | --- | --- |
| Q-018 | Should dedicated NestJS/Node functional artifacts remain allowed where the framework API is inherently functional, or must they be wrapped in classes even when that adds adapter ceremony? | respondida | Allow only the narrow dedicated-file exceptions in AC-255, confined to presentation, infrastructure, composition, or bootstrap; domain and application remain framework-independent and class-first. |
