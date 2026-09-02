# Spec: Payment Federation clean architecture

> feature: payment-federation-clean-architecture
> status: rascunho

## Contexto

The Java runtime contains two bounded contexts, Payment and Inventory, but the
existing package tree mixes global technical layers with an incomplete vertical
Inventory package. The partial Mercado Pago work introduced a second namespace
before migrating the original implementation, producing duplicate classes and a
non-compiling architecture. This feature establishes one executable package
model before provider work continues.

## Histórias

### US-084 — Make bounded contexts and dependency direction explicit

As a maintainer, I want one consistent DDD and Clean Architecture structure, so
that financial and stock responsibilities can evolve without hidden coupling.

#### AC-170 — Payment and Inventory have consistent inward layers

- **Dado** Payment and Inventory sharing the Payment Federation deployment
- **Quando** production Java sources and imports are inspected
- **Então** both contexts live under `dev.desafio.transaction`, domain is framework-free, application depends only on domain and ports, adapters depend inward, and Spring configuration composes implementations at the outer boundary

#### AC-171 — The legacy package tree is completely retired

- **Dado** the canonical `dev.desafio.transaction` implementation
- **Quando** the Java source tree, Spring component scan, tests, and architectural documentation are inspected
- **Então** no production class remains under `dev.desafio.payment`, no duplicate implementation exists, and Payment and Inventory communicate only through versioned event contracts

### US-085 — Preserve behavior while restructuring

As a buyer and operator, I want the structural migration to preserve existing
federation and saga behavior, so that architectural cleanup introduces no
functional regression.

#### AC-172 — The migrated runtime remains executable

- **Dado** the migrated domain, use cases, adapters, configuration, migrations, and tests
- **Quando** Java build/tests, GraphQL composition, event architecture tests, and repository quality gates run
- **Então** the application compiles, existing Card/Pix/inventory behavior remains green, and AC-169 can be proved without compatibility wrappers or disabled tests

### US-086 — Keep the change history reviewable

As a reviewer, I want unrelated identity work and failed generated commits
separated from the architecture change, so that the eventual PR has an honest
and atomic history.

#### AC-173 — The branch contains only intentional commit boundaries

- **Dado** the unpushed feature branch and the user's Better Auth import-order change
- **Quando** the branch history and changed paths are reviewed before merge
- **Então** the identity change is preserved in its own boundary, failed no-op task commits are removed or consolidated safely, and no unrelated file is attributed to the payment refactor

## Fora de escopo

- Adding a third bounded context or separate Inventory deployment.
- Changing externally observable GraphQL fields or event semantics.
- Completing the Mercado Pago sandbox activation before the Java architecture is green.
- Introducing Gradle subprojects, generic repositories, or empty layers merely for symmetry.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-061 | One Spring Boot deployable with package-level bounded contexts is sufficient; separate Gradle modules would add ceremony without an independent build or deployment requirement. | confirmada | The architecture rule requires independent state/invariants, not one artifact per context. |
| ASM-062 | The unpushed branch may be rewritten to remove failed generated/no-op commits while preserving all intentional content. | confirmada | The user explicitly requested separation and cleanup before merge; no remote branch has been pushed. |

## Perguntas em aberto

Nenhuma.
