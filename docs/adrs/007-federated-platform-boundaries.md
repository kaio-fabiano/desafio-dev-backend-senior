# ADR 007: Federated platform boundaries

- Status: accepted for implementation
- Date: 2026-08-28
- Decision owner: platform architecture

## Context

The milestone implementation proved the marketplace journey, but its runtime
layout is not the target architecture. The gateway currently owns loaders and a
subscription proxy, a Commerce application duplicates part of WooCommerce, and
a Stock worker moves native inventory behavior into another process. Bootstrap
files also construct infrastructure that should be owned by NestJS or Spring.

The refactor keeps the observable journey while assigning each business fact to
one bounded context. This ADR is the canonical target for the project graph;
[PRD 01](../prds/01-arquitetura-e-dominio.md),
[PRD 02](../prds/02-graphql-federation.md), and
[PRD 04](../prds/04-commerce-saga-e-realtime.md) describe the consequences in
their respective areas.

## Decision

The platform has five deployable applications. The end-to-end project remains
in the Nx graph but is not deployed. The JSON block below is an executable
architecture contract consumed by `test/federated-platform-refactor.test.mjs`.

<!-- architecture-contract:start -->

```json
{
  "deployableApplications": [
    { "name": "Apollo MCP", "path": "apps/apollo-mcp" },
    { "name": "Gateway", "path": "apps/gateway" },
    { "name": "Identity Federation", "path": "apps/identity-subgraph" },
    { "name": "Payment Federation", "path": "apps/payment-processor" },
    { "name": "WordPress Federation", "path": "apps/wordpress-federation" }
  ],
  "nonDeployableProjects": [{ "name": "End-to-end tests", "path": "apps/e2e" }],
  "retiredApplications": ["apps/commerce-subgraph", "apps/stock-worker"]
}
```

<!-- architecture-contract:end -->

`apps/wordpress-integration` contains reproducible WordPress, WooCommerce, and
plugin support assets. It is infrastructure for WordPress Federation, not an
additional deployable application. A catalog fallback is not part of the target.

## Runtime responsibilities

| Runtime              | Business responsibility                                                                | Composition boundary                                                        | Must not own                                                                     |
| -------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Apollo MCP           | Authenticated MCP tools backed by registered graph operations                          | MCP SDK configuration and a Gateway client                                  | Domain state, direct subgraph clients, or persistence                            |
| Gateway              | Verify identity, propagate safe context, and execute the composed query/mutation graph | NestJS providers for authentication and Apollo Gateway                      | Catalog/order loaders, repositories, commerce clients, or subscription transport |
| Identity Federation  | Identity, sessions, OAuth, registration, and identity-owned graph fields               | `NestJSBetterAuth`, injectable plugin factories, and Identity resolvers     | A second mapping or repository for Better Auth records                           |
| Payment Federation   | Payment commands, invariants, idempotency, payment views, and payment graph fields     | Spring configuration, command/query handlers, and Spring GraphQL Federation | WooCommerce order, cart, catalog, or inventory state                             |
| WordPress Federation | Product, cart, order, customer, inventory, and order-subscription capabilities         | Thin NestJS delegation to WPGraphQL/WooGraphQL and a `graphql-sse` endpoint | Duplicate commercial repositories, loaders, or CRUD models                       |

WordPress/MySQL remains the commercial system of record. Better Auth remains the
owner of its persistence model. Payment owns its aggregate and dedicated read
view. Gateway and Apollo MCP are stateless edges.

## Executable dependency boundaries

Dependencies point inward inside a bounded context:

| Layer       | May depend on                          |
| ----------- | -------------------------------------- |
| Domain      | None                                   |
| Application | Domain and declared ports              |
| Adapters    | Application, domain, and contracts     |
| Composition | Adapters and shared platform providers |

NestJS, Spring configuration, GraphQL controllers/resolvers, persistence,
WPGraphQL/WooCommerce clients, and messaging clients are adapters or composition
details. They cannot be imported by domain or application code. Across bounded
contexts, only versioned contracts and federated references cross; one context
never imports another context's adapter or accesses its database.

Provider modules are intentionally narrow. A provider belongs to a context when
only that context uses it. `libs/platform/nest` accepts a provider only after at
least two NestJS runtimes share the same lifecycle or configuration behavior.
Application bootstraps create the framework application and request shutdown;
they do not assemble infrastructure graphs manually.

## Deliberately omitted abstractions

- No Commerce subgraph or Stock worker remains. Native WooCommerce capabilities
  own cart, order, and inventory behavior.
- No generic DDD framework, repository base class, service hierarchy, command
  bus, event sourcing platform, or distributed command bus is introduced.
- No gateway DataLoader, business client, repository, or subscription proxy is
  introduced. Those concerns remain with the owning federation.
- No custom WordPress commercial schema is built when WPGraphQL or WooGraphQL
  already supplies the capability.
- No Identity MikroORM mapping mirrors Better Auth. Add first-party persistence
  only if a future identity-owned model is proved by a failing requirement.
- RabbitMQ, an outbox, and a generic distributed saga are not target components.
  Introduce a specific asynchronous integration only after executable evidence
  shows that synchronous owner APIs and native WooCommerce transitions are
  insufficient.

## Quality gates and executable evidence

| Decision                          | Enforced rule                                                                                             | Evidence                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime inventory                 | Exactly the five deployables and the non-deployable E2E project are allowed                               | `test/federated-platform-refactor.test.mjs`, then `test/five-app-topology.test.mjs` after migration            |
| Provider boundary                 | Frameworks compose adapters; bootstrap and core layers do not construct infrastructure                    | `test/architecture-boundaries.test.mjs` plus the Identity, Gateway, WordPress, and subscription refactor tests |
| Domain decision                   | Commercial state belongs to WordPress; payment invariants belong to Payment; Better Auth owns its records | `test/architecture-boundaries.test.mjs` plus focused federation tests                                          |
| Deliberately omitted abstractions | The omissions above stay absent unless a failing acceptance test justifies one                            | `test/federated-platform-refactor.test.mjs` and the final architecture review                                  |

Run the gates introduced by this decision with:

```sh
node --test --test-reporter=tap test/architecture-boundaries.test.mjs test/federated-platform-refactor.test.mjs
corepack pnpm@10.17.1 exec nx run-many --target=build,typecheck,lint,test --all
```

The second command is also available as `quality:nx`. Composition, focused
unit/integration tests, and the end-to-end journey remain required in the final
quality gate; the architecture tests do not replace them.

## Consequences

The runtime list becomes smaller and each remaining process has one explainable
reason to exist. Native products keep ownership of their models, while the
project retains explicit application logic only for identity integration,
payment invariants, federation composition, and authenticated real-time
delivery.

This decision supersedes ADR 001's gateway subscription proxy, ADR 003's ban on
a thin NestJS WordPress wrapper, ADR 005's planned Identity/Commerce MikroORM
ownership, and ADR 006's Commerce-owned reconciliation. It preserves the proven
protocol and product choices: GraphQL over SSE, plugin-first WordPress,
Better Auth, Java 21/Spring Boot, Gradle through Nx, and stable idempotency keys.

During migration, old projects may exist only until their replacement acceptance
tests pass. Their temporary presence is not permission to add new behavior to
them, and the final topology gate must enumerate the project graph rather than
trust documentation alone.
