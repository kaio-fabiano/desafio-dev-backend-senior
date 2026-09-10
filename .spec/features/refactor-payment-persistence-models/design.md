# Design: Payment Federation ORM persistence

## Decision

Replace project-owned runtime JDBC persistence with Spring Data JPA while preserving the existing ports and observable behavior. Flyway remains the schema authority; Hibernate remains configured with `ddl-auto=validate` and `open-in-view=false`.

## Dependency direction

```text
configuration -> JPA adapters -> application ports -> domain
```

Domain and Application remain free of Jakarta Persistence, Spring Data, JDBC, and database-specific APIs. Persistence entities, Spring Data repositories, converters, and mappers live in adapter or infrastructure packages.

## Modeling rules adopted from the reference project

- Use validated, context-specific identity/value types where they prevent invalid persisted state; do not add a universal base entity or generic reference abstraction.
- Represent cross-context relationships as identity values. Do not create ORM associations, cascades, joins, or foreign keys across bounded contexts.
- Use ORM relationships only inside one owner and only when the database relationship represents the same consistency boundary. Default to lazy loading and no cascade across independent records.
- Save, clear the persistence context, and reload through the owning repository in integration tests. Reload remains an application/repository operation, never a domain dependency on `EntityManager`.
- Reconcile managed relationships by identity so a loaded entity is not replaced by an identity-only reference during replay or update.
- Keep lifecycle decisions in domain aggregates; JPA models persist and translate them. Database constraints close uniqueness and concurrency gaps.

## Persistence boundaries

| Boundary | Models | Consistency mechanism |
|---|---|---|
| Inventory | claim/operation, completion outbox/inbox, reservation projection | transaction plus optimistic or pessimistic ORM locking; projection separated from claim storage |
| Payment | payment record, provider effect, provider notification, inbox/outbox | transaction plus locked identity lookup and conditional lifecycle checks |
| Transaction | checkout operation, transaction projection | transaction plus lease-owner checks, ORM locking, event-version guard |
| Shared delivery | three schema-specific inbox entities and three schema-specific outbox entities | context-local transactions and non-blocking ORM lock/query hints |

## Schema changes

- Add a dedicated Inventory reservation projection table/model instead of overloading claim columns.
- Add an explicit Payment transaction reference without reusing the external order reference.
- Align Inventory status constraints with every domain state, including `COMMIT_REJECTED`.
- Preserve existing keys, unique constraints, indexes, and append-only Flyway evolution.

## Verification

Each context owns focused JUnit/Testcontainers tests for round-trip, reload, constraints, idempotency, and concurrency. A final ArchUnit/source gate rejects ORM dependencies in Domain/Application and rejects handwritten runtime SQL. Existing PostgreSQL, replay, restart, GraphQL, AMQP, and choreography suites provide regression evidence. Node test wrappers expose every acceptance criterion to `onp-spec verify`.
