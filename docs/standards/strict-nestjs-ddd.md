# Strict NestJS DDD standard

This is the mandatory contract for TypeScript and NestJS production code. It
governs structure and ownership without changing public API, persistence, or
transport behavior.

## Strategic design and ownership

- A bounded context owns one cohesive business capability, its invariants, and
  its authoritative state. Identity owns authentication and identity data;
  Commercial owns catalog, cart, checkout, orders, customers, and inventory;
  Workflow owns checkout delivery mechanics; Payment owns payment state; Edge
  composes and authenticates but owns no business persistence.
- Cross-context collaboration uses versioned contracts or federated references.
  It never imports another context's domain, application, adapter, or database.
- Each use case has one owning context and one explicit application entry
  point. A use case must not hide business decisions in controllers, resolvers,
  modules, repositories, or transport adapters.

## Tactical design

- Aggregates protect invariants and expose methods for state transitions.
  Entities, value objects, domain events, domain services, use cases, commands,
  queries, DTOs, errors, mappers, ports, and adapters each have one focused
  class in a role-named file when that role is needed.
- If no aggregate is needed, the implementation records that explicit absence
  and identifies the consistency boundary instead of inventing one.
- Invariants belong in the aggregate or domain service; application code
  coordinates; adapters translate and persist; composition wires dependencies.

## Dependency direction and file rules

```text
composition -> adapters -> application -> domain
                         -> versioned contracts
```

- Domain imports no NestJS, GraphQL, ORM, transport, adapter, or other
  bounded-context internals. Application imports domain and abstract ports,
  never concrete infrastructure.
- Production files have one primary responsibility and do not colocate
  classes, interfaces, type aliases, enums, functions, or runtime constants
  belonging to another role. Names describe the role and bounded context.
- Ports are abstract classes. Adapters implement ports at the outer boundary.
  Dependency injection is configured in composition files, not in domain code.

## Narrow exceptions

Only dedicated outer-layer files may use functional artifacts required by
Node.js or NestJS: bootstrap entry points, custom decorators, generated code,
migrations, and barrels. The exception is explicit and auditable; it never
applies to domain, application, service, controller, resolver, provider, or
module classes, and it never permits mixing architectural layers.

## Required evidence

Every change follows Red, Green, Refactor when production behavior changes.
Unit tests cover domain and application rules; integration tests cover adapter
and persistence wiring; contract tests cover public GraphQL, HTTP, SSE, OAuth,
messaging, and persistence compatibility; relevant end-to-end tests cover
cross-context behavior. Architecture tests enforce the dependency and file
rules. A change is incomplete while any applicable layer or quality gate is
red.

Before implementation, the task notes must state: bounded context, use case,
aggregate or explicit absence, invariants, consistency boundary, and affected
ports. No agent may omit or silently weaken these decisions.
