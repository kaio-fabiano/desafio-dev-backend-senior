# Spec: Retire Milestone Zero PoC gates

> feature: retire-milestone-zero-poc-gates
> status: em-implementacao

## Contexto

Milestone Zero resolved architecture uncertainty before the production-oriented
applications existed. The obsolete PoC applications were later removed, but
their feature remains active and their compatibility tests still run as default
project tests. This makes unrelated changes start Docker-backed WordPress,
Rover composition, and retired fixture harnesses. Completed experiments must be
historical evidence; current behavior must be owned by current tests and heavy
acceptance must run only through an explicit target.

## Histórias

### US-131 — Keep completed experiments out of current quality gates

As a maintainer, I want completed Milestone Zero experiments retired from the
active specification and default test graph so that ordinary changes validate
the current architecture without replaying obsolete PoCs.

#### AC-277 — Completed Milestone Zero evidence is historical

- **Dado** the Milestone Zero decisions are closed and their PoC applications have already been removed
- **Quando** active specifications and default tests are enumerated
- **Então** the Milestone Zero feature, verification record, scaffold marker, decision-text tests, and superseded PoC tests are absent while the architectural decisions remain documented in ADRs and the risk register

#### AC-278 — Default tests avoid the heavy WordPress compatibility probe

- **Dado** the WordPress integration remains a supported production-oriented boundary
- **Quando** the workspace runs the project's default `test` targets
- **Então** no default target starts the Docker-backed WordPress/Rover compatibility probe, while that probe remains available through an explicit non-default acceptance target

#### AC-279 — Current behavior owns current regression evidence

- **Dado** OAuth, Gateway SSE, WordPress federation, ownership, and order reconciliation now belong to mature application boundaries
- **Quando** repository evidence and architecture decisions are inspected
- **Então** they reference current unit, integration, acceptance, or end-to-end tests instead of retired Milestone Zero harnesses

## Fora de escopo

- Changing production behavior, domain invariants, public APIs, or deployment topology.
- Removing the supported `apps/wordpress-integration` project or its production plugin.
- Running external sandbox, cloud, load, backup, or production-readiness validation.
- Implementing the still-open registration recovery decision D-007.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-098 | The current application-level and end-to-end suites are authoritative for behavior already promoted out of Milestone Zero. | confirmada | The owner confirmed that the repository has matured beyond the PoCs, and the repository contains current OAuth, SSE, federation, ownership, reconciliation, and E2E tests. |
| ASM-099 | The live WordPress compatibility probe remains useful only as explicitly requested acceptance evidence. | confirmada | The owner requested that slow, unused PoC validation leave the normal gate; keeping the existing probe behind a dedicated target preserves the cheapest recovery path. |

## Perguntas em aberto

None.
