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

This migration covers every project-owned source and configuration artifact
except these two application roots:

- `apps/order-workflow-subgraph`, whose checkout and order workflow will be
  redesigned by a later specification;
- `apps/payment-federation`, which is Java/Spring and belongs to a separate
  architecture effort.

The exclusion is path-specific, not capability-wide. Public contracts and
clients used to communicate with either excluded application remain in scope,
but their compatibility must be preserved.

That behavior is transitional. A separate future specification must redesign
the flow around WooCommerce as the cart/order source of truth and place the
remaining post-checkout business workflow in Java. The project-owned WordPress
integration is in scope now, but this migration may only improve its boundaries,
security, compatibility, and maintainability; it must not implement that future
checkout/order redesign.

## Repository architecture classification

| Scope | Architectural treatment |
| --- | --- |
| `libs/identity/nest`, `apps/identity-subgraph` | Identity bounded context: pure domain/application core, outer Better Auth/WordPress/database adapters, GraphQL/HTTP presentation, NestJS composition |
| `libs/platform/nest` | Access-control supporting context: pure authorization policy/application contracts plus NestJS guards, decorators, request adapters, and composition |
| `libs/gateway/nest`, `apps/gateway` | Edge context: focused application orchestration and abstract ports, transport/vendor adapters, thin presentation and composition; no invented aggregate |
| `apps/wordpress-integration` | WordPress/WooCommerce plugin architecture with thin bootstrap/hooks, namespaced responsibilities, secure boundaries, WooCommerce CRUD and HPOS compatibility |
| `libs/contracts`, `apps/apollo-mcp` | Versioned integration-contract and declarative adapter boundaries; schema/operation validation, no tactical DDD ceremony |
| `infra` | Deployment and observability boundary; typed configuration, secret boundaries, validation, no domain layer |
| `apps/e2e`, repository test tooling and scripts | Acceptance and delivery tooling; focused helpers and deterministic environment boundaries, no production-domain modeling |

Generated artifacts, caches, dependencies, and build outputs are ignored by
source rules through explicit patterns. They are never counted as migrated
production code.

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
10. every in-scope production path maps to a declared context, layer, or
    technical-boundary policy; an unclassified file is a violation;
11. dependency checks use that explicit map, not only folder-name substring
    detection, so absent `domain` or `application` folders cannot pass falsely;
12. only the two application exclusions in Migration scope are accepted.

The TypeScript one-class-per-file grammar applies to project-owned production
TypeScript. PHP, shell, JavaScript test tooling, GraphQL, JSON, and YAML use
their own syntax-aware checks and ownership rules. A configuration or bootstrap
exception never authorizes business orchestration in an outer-layer file.

The constitution receives mandatory principles backed by this test. `AGENTS.md`
links to the canonical standard and requires the strategic DDD gate in every
implementation task.

## Migration inventory

The inventory must be recomputed from repository-owned paths, subtracting only
the two excluded application roots and explicit generated/build/dependency
patterns. It must classify NestJS TypeScript, WordPress/PHP, Apollo MCP,
contracts, infrastructure, scripts, and test tooling separately. Known
hotspots include Identity registration and Better Auth services, Platform OAuth
verification, Gateway authentication/federation/SSE, and the WordPress plugin.

The architecture scanner must keep both excluded application roots outside this
migration's baseline and must report an error if any task in this feature
attempts to modify their files. This is a scope exclusion, not evidence that
their current architecture already complies with the strict standard.

## Rollout strategy

### Corrective Wave 0 — Truthful inventory and non-regression gate

Replace the partial-root scanner with an explicit repository classification.
Add fixtures proving that unlayered orchestration and unclassified production
files fail. Recompute a truthful baseline; zero is forbidden while known
violations remain.

### Corrective Wave 1 — Identity core and adapters

First extract framework-independent Identity domain concepts, application use
cases, and abstract ports behind characterization tests. Then adapt Better Auth,
WordPress, database, OAuth issuer, GraphQL, and NestJS composition to those
ports. The application roots remain composition and delivery only.

### Corrective Wave 2 — Platform and Gateway edges

Separate access-control policy from NestJS guards and request conversion.
Separate Gateway orchestration and ports from concrete JWT, federation, cookie,
and SSE adapters. Preserve public behavior and do not edit Order Workflow.

### Corrective Wave 3 — WordPress and technical boundaries

Refactor the project-owned WordPress/WooCommerce integration using native plugin
and WooCommerce conventions, including HPOS-safe CRUD and secure hooks. Validate
Apollo MCP operations, shared contracts, infrastructure, deployment scripts,
and acceptance tooling under boundary-specific rules without fake DDD layers.

### Corrective Wave 4 — Close the repository baseline

Remove the final legacy entries, run all quality gates, update the graph and
architecture documentation, and require zero in-scope exceptions and zero
unclassified project-owned production files in CI.

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
