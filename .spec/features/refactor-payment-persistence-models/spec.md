# Spec: Refactor Payment Federation persistence models

> feature: refactor-payment-persistence-models
> status: rascunho

## Context

Payment Federation already includes Spring Data JPA and validates its Flyway schema, but its business persistence is implemented by handwritten JDBC and embedded SQL across Payment, Inventory, Transaction, and shared AMQP delivery. The application has no project-owned JPA entities or Spring Data repositories. This makes validation, relationships, reload behavior, and concurrency rules implicit in large adapters instead of explicit in persistence models and executable tests.

The refactor adopts the useful modeling concepts from `Projects/axon-graphql-posts`: validated identities and values, aggregate references by identity, explicit ownership, save/clear/reload tests, schema validation, and repository adapters over Spring Data. Unlike that reference project, this repository's strict DDD contract keeps Jakarta Persistence and Spring Data outside Domain and Application.

## Histórias

### US-139 — Persist Payment Federation through explicit ORM models

As a maintainer, I want Payment Federation persistence represented by validated JPA models and Spring Data repositories so that database behavior is understandable, testable, and independent from handwritten runtime SQL.

#### AC-298 — Persistence modeling respects bounded contexts

- **Dado** the Payment, Inventory, Transaction, and shared delivery bounded contexts
- **Quando** their production persistence models and dependencies are inspected
- **Então** JPA remains in adapter or infrastructure packages, Domain and Application remain framework-independent, cross-context relationships use validated identity references, and cascades do not cross aggregate or context boundaries

#### AC-299 — Inventory state round-trips without overloaded persistence columns

- **Dado** inventory claims, leases, completion events, and reservation projections persisted in PostgreSQL
- **Quando** they are saved, the persistence context is cleared, and they are reloaded through the Inventory ports
- **Então** every validated value and status round-trips, duplicate and concurrent claims preserve their existing outcomes, reservation projections use their own model, and `COMMIT_REJECTED` is accepted by the schema

#### AC-300 — Payment state preserves financial idempotency through ORM

- **Dado** payment records, provider effects, notifications, inbox entries, and outbox entries persisted in PostgreSQL
- **Quando** payment, refund, duplicate delivery, retry, and provider-notification flows are executed and reloaded
- **Então** Spring Data JPA preserves at-most-once effects, identifier collision detection, conditional state transitions, and the distinct meanings of transaction and external order references

#### AC-301 — Transaction state preserves checkout lease and projection behavior

- **Dado** checkout operations and transaction projections persisted in PostgreSQL
- **Quando** concurrent claims, lease recovery, projection updates, and owner-scoped reads are executed and reloaded
- **Então** ORM mappings preserve the current observable results, JSON item values, uniqueness rules, ownership isolation, and transaction lifecycle without associating the checkout aggregate to another bounded context

#### AC-302 — Shared delivery preserves reliable concurrent claims

- **Dado** inbox and outbox records owned separately by the Payment, Inventory, and Transaction schemas
- **Quando** duplicate consumers and concurrent relays claim, publish, fail, recover, and complete records
- **Então** JPA-backed stores preserve deduplication, retry timing, claim ownership, and skip-locked-equivalent non-blocking delivery without sharing persistence entities across schema boundaries

#### AC-303 — Runtime persistence contains no handwritten SQL

- **Dado** all project-owned Payment Federation production Java sources after the refactor
- **Quando** architecture checks and the complete Java quality suite run
- **Então** business persistence uses JPA, Spring Data derived queries, JPQL, Criteria, and ORM locking only; no `JdbcTemplate`, `java.sql` statement, native query, or embedded SQL remains, while Flyway migrations and test-fixture SQL remain allowed

#### AC-304 — Flyway remains the schema authority

- **Dado** a fresh PostgreSQL database migrated by Flyway
- **Quando** Hibernate validates the mapped entities and the application restarts
- **Então** every project-owned ORM model matches its schema constraints, indexes, nullability, enums, and references without schema creation or update by Hibernate

## Fora de escopo

- Replacing Axon Framework's event store, token store, or framework-owned persistence.
- Changing GraphQL, AMQP, OAuth, Mercado Pago, or WooCommerce public contracts.
- Adding a universal base entity, generic `Ref<T>`, custom ORM framework, or a new persistence dependency.
- Replacing Flyway migrations with Hibernate schema generation.
- Reworking payment-provider execution behavior already owned by `recover-payment-provider-effects`.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-108 | “No native query” applies to project-owned production Java; Flyway migrations and SQL used only by integration-test setup/assertions remain allowed. | confirmada | Runtime repositories are the requested ORM target; Flyway must remain the schema authority and PostgreSQL integration tests may inspect the real database. |
| ASM-109 | Concepts from `axon-graphql-posts` must be adapted to this repository's stricter dependency direction instead of copying JPA annotations into Domain. | confirmada | `AGENTS.md` requires Domain and Application to remain framework-independent. |
| ASM-110 | Existing public behavior and ports remain compatible unless a current persistence ambiguity is proven and covered by a migration and regression test. | confirmada | This is a persistence refactor, and the user did not request transport or business-contract changes. |
| ASM-111 | Maximum safe parallelism is the four file-disjoint context tasks after specification, with final integration serialized. | confirmada | The user explicitly requested the maximum number of agents; repository analysis found four independent persistence ownership boundaries. |

## Perguntas em aberto

| ID | Question | Status | Answer |
|---|---|---|---|
| Q-002 | What is the second requested item after this ORM/modeling refactor? | respondida | The owner confirmed execution without adding the second item, so this feature closes only the described ORM/modeling refactor; a later request may specify separate work. |
