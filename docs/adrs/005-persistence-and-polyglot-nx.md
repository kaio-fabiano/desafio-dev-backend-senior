# ADR 005: Use MikroORM and integrate the Java processor through Nx

- Status: accepted for implementation
- Date: 2026-08-27
- Decision owner: application and platform architecture

## Context

The first-party NestJS services need PostgreSQL persistence without coupling the
domain to a framework. Better Auth already owns its authentication storage. The
payment processor has not been implemented, so its runtime can still change at
negligible migration cost. All runtimes must remain operable through one monorepo
task graph and cache.

## Decision

- Use MikroORM with PostgreSQL for first-party Identity and Commerce entities,
  repositories, transactions, and versioned migrations.
- Keep repository interfaces in the domain/application boundary. MikroORM entity
  mapping and `EntityManager` usage remain in infrastructure.
- Let Better Auth exclusively own and migrate its internal tables. First-party
  profile, supplier, link, workflow, idempotency, and outbox tables belong to
  MikroORM; integration uses stable Better Auth identifiers rather than duplicate
  ORM mappings of Better Auth tables.
- Implement the payment processor with Java 21, Spring Boot, and Gradle. Preserve
  the previously planned ports/adapters, inbox, idempotency, and event contracts.
- Register Gradle projects and tasks through `@nx/gradle`, with Nx as the single
  entry point for affected execution, local/CI caching, graph inspection, and CI.
- Use Nx dynamic output, Nx Console, and `nx graph`; defer a custom TUI until a
  concrete workflow cannot be served by these facilities.

## Consequences

The NestJS applications gain an official integration, request-scoped unit of
work, and migration tooling without taking ownership away from Better Auth.
Java adds a second application toolchain and container image, but Gradle tasks
remain visible to Nx. The architecture avoids a speculative terminal application
and keeps the payment domain contract independent of Spring.

## Verification required during implementation

- a request and a queue consumer use isolated MikroORM contexts;
- an atomic commerce transaction writes the aggregate and outbox record;
- migrations are reproducible from a clean PostgreSQL database;
- Better Auth upgrades do not require MikroORM metadata for Better Auth tables;
- Nx detects, runs, and caches the Java build and tests through `@nx/gradle`.
