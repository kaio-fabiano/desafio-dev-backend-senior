# Design: Strict NestJS DDD migration

## Decision

Adopt strategic DDD plus ports and adapters inside each bounded context. NestJS
is a delivery and composition framework at the outside boundary; it is not the
domain model and must not decorate domain or application classes.

This design intentionally distinguishes two rules:

1. Every class file owns exactly one production class and no other top-level
   declaration.
2. Every production concept is class-first, with a small list of framework
   artifacts that remain functional because their host API is functional.

The second rule prevents artificial wrapper classes around `bootstrap`, NestJS
custom decorators, generated sources, and barrel exports. These exceptions are
file roles, not exceptions granted to individual services.

## Migration scope

This migration covers only the stable NestJS Platform, Gateway, and Identity
roots. `apps/order-workflow-subgraph` is excluded completely: this plan must not
refactor, repackage, or establish new domain abstractions around its current
checkout, idempotency, saga, queue, persistence, or order-processing behavior.

That behavior is transitional. A separate future specification must redesign
the flow around WooCommerce as the cart/order source of truth and place the
remaining post-checkout business workflow in Java. The Java and WordPress
changes themselves are also outside this migration.

## Strategic DDD gate before implementation

Every feature specification and pull request must name:

- bounded context and business owner;
- ubiquitous-language terms introduced or changed;
- use case and actor;
- aggregate root, or the explicit reason no aggregate is involved;
- invariants protected by the aggregate;
- transactional consistency boundary;
- commands, queries, and domain events involved;
- external systems and the ports that isolate them;
- cross-context contract and compatibility impact.

If these answers are unknown, implementation remains blocked at design. A NestJS
module name or database table is not evidence of a bounded context.

## Canonical bounded-context layout

```text
<context>/
├── domain/
│   ├── aggregates/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── services/
│   └── errors/
├── application/
│   ├── use-cases/
│   ├── commands/
│   ├── queries/
│   ├── ports/
│   └── dto/
├── infrastructure/
│   ├── persistence/
│   ├── messaging/
│   └── integrations/
├── presentation/
│   ├── graphql/
│   └── http/
└── composition/
    ├── modules/
    └── providers/
```

Folders are created only when a context needs them. This is a dependency map,
not a requirement to create empty scaffolding.

## Mandatory dependency matrix

| Source layer | May depend on | Must not depend on |
| --- | --- | --- |
| Domain | Same-context domain classes and language/runtime standard library | NestJS, GraphQL, ORM, HTTP, queues, adapters, application, another context |
| Application | Same-context domain and abstract ports | NestJS, concrete adapters, ORM, transports, another context internals |
| Infrastructure | Same-context application ports, domain, vendor SDKs | Presentation and another context internals |
| Presentation | Application use cases and boundary DTOs | ORM entities, concrete repositories, aggregate mutation internals |
| Composition | All same-context layers needed for wiring | Business rules |

Cross-context collaboration uses versioned contracts, federated references, or
integration events. A context never imports another context's domain, repository,
adapter, use case, or database model.

## Tactical DDD rules

### Aggregates and entities

- An aggregate root is the only external mutation entry point for its aggregate.
- Constructors do not allow invalid state. Use a static named constructor when
  creation requires validation or emits an event.
- State is private; mutations are intention-revealing methods.
- Invariants are checked inside the aggregate, not controllers or repositories.
- One transaction changes one aggregate unless a documented consistency rule
  proves a wider boundary is necessary.
- Entities have stable identity. Objects without identity and defined by their
  values are value objects.

### Value objects and errors

- Value objects are immutable classes and validate themselves at construction.
- Primitive aliases do not model domain concepts.
- Each domain or application error is its own class and file.
- Domain errors contain no HTTP, GraphQL, or transport status.

### Domain events and services

- Domain events are immutable past-tense classes in individual files.
- Events describe facts that already happened and contain only contract-relevant
  data.
- A domain service is allowed only when a business rule does not naturally
  belong to one entity or value object.
- Event publication and transport belong outside the domain.

### Application layer

- One use-case class represents one actor intention.
- Use cases coordinate aggregates, ports, transactions, and authorization policy;
  they do not implement transport or persistence details.
- Commands, queries, input DTOs, and output DTOs are individual classes.
- Ports are abstract classes so they are both architectural contracts and valid
  NestJS injection tokens. Generic CRUD repositories are forbidden.
- Repository ports use domain language and return aggregates or domain values,
  never ORM entities.

### Adapters and NestJS

- Every concrete repository, client, publisher, consumer, mapper, controller,
  resolver, guard, pipe, interceptor, filter, middleware, provider factory, and
  module is one class in one file.
- ORM entities and persistence mappers are infrastructure classes; they are not
  domain entities.
- Controllers and resolvers validate/translate input, invoke one use case, and
  map the result. They contain no business decisions.
- Nest-facing classes use the appropriate NestJS decorator or lifecycle contract.
- Domain and application classes never use `@Injectable()` merely to make NestJS
  dependency injection convenient. Composition binds them explicitly.
- Module files contain only imports, the `@Module()` metadata, and the module
  class. Provider construction logic belongs to a dedicated provider-factory
  class.

## Mandatory file grammar

For non-test TypeScript production files:

- A class file exports exactly one class, including abstract classes.
- It declares no additional top-level class, interface, type alias, enum,
  function, or runtime constant, exported or private.
- Private implementation helpers become private class methods. Reusable concepts
  become their own named class in their own file.
- The file name describes the role: `.aggregate.ts`, `.entity.ts`,
  `.value-object.ts`, `.domain-event.ts`, `.domain-service.ts`, `.use-case.ts`,
  `.command.ts`, `.query.ts`, `.dto.ts`, `.error.ts`, `.port.ts`, `.mapper.ts`,
  `.adapter.ts`, `.controller.ts`, `.resolver.ts`, `.guard.ts`, `.pipe.ts`,
  `.interceptor.ts`, `.filter.ts`, `.middleware.ts`, `.provider.ts`, or
  `.module.ts`.
- Interfaces and type aliases are not production modeling tools in domain or
  application layers. Abstract classes and immutable data classes replace them.
- `Record<K, V>` may be used only inline as the type of a genuine keyed
  collection, such as adapter metadata, configuration, or an internal read
  model. It must not replace or be exported as an entity, aggregate, value
  object, DTO, command, query, event, error, port, or other domain/application
  concept.
- Enums that carry domain meaning become value-object classes. Vendor enums may
  remain confined to an adapter boundary if conversion is immediate.
- A file named `.service.ts` must contain one service class only. Prefer a
  business role such as `.use-case.ts`, `.domain-service.ts`, or `.adapter.ts`
  instead of a generic service name.

### Dedicated-file exceptions

The architecture gate may recognize only these categories:

- `main.ts`: application bootstrap;
- `index.ts`: exports only, with no executable declarations;
- `*.decorator.ts`: one NestJS custom decorator export and its non-exported
  callback only when required by `createParamDecorator`/`SetMetadata`;
- `*.config.ts`: one framework configuration export only when a class cannot be
  consumed by the vendor API;
- generated sources identified by an explicit generated marker/path;
- ORM migration classes, still one class per file;
- `.d.ts` declaration files.

There is no wildcard legacy exception. During migration, each existing violating
file is listed explicitly in a shrinking baseline. New entries are forbidden.

## Enforcement architecture

Create a TypeScript-compiler-AST architecture test rather than a regex-only
check. It must report source locations and enforce:

1. one class and no sibling declaration per class file;
2. dedicated exception file grammar;
3. suffix-to-class-role consistency;
4. forbidden NestJS/framework imports in domain and application;
5. no cross-context internal imports;
6. abstract-class ports and adapter-to-port conformance;
7. a legacy baseline that can only shrink;
8. no empty architectural folders or speculative shared abstractions.
9. `Record<K, V>` is never used as a substitute for a domain or application
   modeling class.

The constitution receives mandatory principles backed by this test. `AGENTS.md`
links to the canonical standard and requires the strategic DDD gate in every
implementation task.

## Migration inventory

The final AST inventory must be recomputed only for the in-scope Platform,
Gateway, and Identity roots during Wave 0. The previous repository-wide count
included the now-excluded Order Workflow and is therefore not a valid baseline.
Known in-scope hotspots include Gateway and Identity files that mix NestJS
classes with types, configuration callbacks, tokens, or helper functions.

The architecture scanner must keep the Order Workflow outside this migration's
baseline and must report an error if any task in this feature attempts to modify
its files. This is a scope exclusion, not evidence that its current architecture
already complies with the strict standard.

## Rollout strategy

### Wave 0 — Governance and non-regression gate

Publish the standard, agent rules, constitution principles, AST test, and the
explicit legacy baseline. From this point onward no new violation is accepted.

### Wave 1 — Shared platform and Gateway

Split OAuth resource contracts, errors, request conversion, tokens, Gateway
context data, federation capabilities, and module factories. These are shared
or edge concerns with relatively small domain impact.

### Wave 2 — Identity

Separate Better Auth options, factories, errors, OAuth resource definitions,
registration errors/compensation, WordPress configuration, GraphQL DTOs, and
cursor behavior into focused classes and adapters.

### Wave 3 — Close the in-scope baseline

Remove the final legacy entries, run all quality gates, update the graph and
architecture documentation, and require zero in-scope exceptions in CI.

## Verification pyramid

- Domain unit tests prove constructors, value equality, transitions, and invariants.
- Application unit tests prove use cases against typed abstract-port substitutes.
- Adapter integration tests prove ORM, RabbitMQ, Better Auth, WordPress, and HTTP
  mappings at their real boundaries.
- Controller/resolver contract tests prove validation and response translation.
- Existing end-to-end tests prove that structural migration did not change public
  behavior.
- AST architecture tests prove the rules that ordinary behavior tests cannot.

## Rollback and delivery constraints

- Migrate one bounded context or coherent subgraph per mergeable task.
- Add characterization tests before moving behavior.
- Keep old and new structures behind the same public module contract within a
  wave; do not maintain two business implementations.
- Do not combine file migration with schema or business-rule changes.
- One task produces one atomic commit and removes its migrated files from the
  legacy baseline.
