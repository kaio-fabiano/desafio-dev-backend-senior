# Spec: Align Payment Federation naming

> feature: align-payment-federation-naming
> status: rascunho

## Context

The Java runtime is the Payment Federation and contains Payment and Inventory
as asynchronous participants, but its application path, Nx project, Compose
service, and runtime identifiers still use the retired `payment-processor`
name. A retired Catalog contract also remains outside the active supergraph.

## User stories

### US-074 — Make runtime naming match its bounded context

As a maintainer, I want the Java runtime named Payment Federation everywhere,
so that deployment and source structure communicate its actual responsibility.

#### AC-152 — Payment Federation has one canonical name

- **Dado** the application, Nx graph, Compose topology, and deployment configuration
- **Quando** their active runtime names and paths are inspected
- **Então** they consistently use `payment-federation` without active `payment-processor` references

#### AC-153 — Payment and Inventory remain internal participants

- **Dado** the renamed Java runtime
- **Quando** its package and messaging structure is inspected
- **Então** Payment and Inventory remain isolated modules and RabbitMQ participants in the same deployment

### US-075 — Remove the retired Catalog contract

As a maintainer, I want only composed GraphQL contracts retained, so that no
schema suggests ownership by a service that no longer exists.

#### AC-154 — Catalog contract is absent

- **Dado** the GraphQL contract directory and supergraph configuration
- **Quando** active subgraphs are enumerated
- **Então** the orphan Catalog contract is absent and the four supported subgraphs still compose

### US-076 — Make the WordPress bootstrap reproducible

As a maintainer, I want local plugin installation to reuse exact pinned versions,
so that tests do not depend on downloading unchanged plugins on every run.

#### AC-155 — Plugin bootstrap is idempotent and deployment remains immutable

- **Dado** pinned WordPress plugin versions and an existing local installation
- **Quando** the bootstrap runs again
- **Então** exact versions are reused, missing or mismatched versions are installed, and production deployment is documented as an immutable prebuilt image

## Out of scope

- Changing Java package names under `dev.desafio.payment`.
- Splitting Inventory into another application or container.
- Changing RabbitMQ event or queue names, because those are versioned protocol identifiers.
- Integrating a real payment provider.
- Building the production WordPress image in this feature.

## Suposições

| ID      | Assumption                                                                           | Status    | Resolution                                                                           |
| ------- | ------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------ |
| ASM-056 | Versioned AMQP identifiers retain `payment-processor.v1` for backward compatibility. | confirmada | Renaming a deployed protocol requires a separate migration and compatibility window. |

## Perguntas em aberto

None.
