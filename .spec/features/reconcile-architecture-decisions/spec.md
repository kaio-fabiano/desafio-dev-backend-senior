# Spec: Reconcile architecture decisions

> feature: reconcile-architecture-decisions
> status: auditada

## Context

The risk register still describes four challenge architecture decisions as
open or awaiting a proof of concept, although their executable acceptance
tests now pass. Maintainers need the decision status to match the delivered
runtime without confusing repository evidence with external production proof.

## User stories

### US-093 — Trust the architecture decision register

As a maintainer, I want resolved architecture decisions linked to executable
evidence, so that delivery planning does not repeat completed work.

#### AC-185 — Completed proofs close their architecture decisions

- **Dado** the delivered SSE, OAuth, WordPress federation, and checkout reconciliation paths
- **Quando** the architecture decision register is inspected
- **Então** D-001, D-002, D-003, and D-011 are recorded as proved and each decision identifies its executable evidence

#### AC-186 — Production activation remains explicitly separate

- **Dado** repository tests that do not deploy or exercise external production services
- **Quando** a completed challenge decision is documented
- **Então** its status does not claim sandbox, infrastructure, or production readiness and the production gap register remains open

## Out of scope

- Changing runtime code or architecture.
- Running Mercado Pago sandbox transactions.
- Deploying infrastructure or closing any production-readiness gap.
- Reconsidering an accepted decision whose executable evidence still passes.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-066 | The current executable tests remain the authoritative evidence for these four challenge decisions. | confirmada | The complete specification suite and CI audit passed immediately before this reconciliation. |

## Perguntas em aberto

None.
