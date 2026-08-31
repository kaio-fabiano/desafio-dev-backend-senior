# Spec: Remove retired applications

> feature: remove-retired-applications
> status: auditada

## Contexto

The five-application architecture retired the Commerce subgraph and Stock worker, but their source trees and historical executable targets still remain in the Nx workspace. This makes the repository contradict its documented topology.

## Histórias

### US-053 — Keep only supported applications

As a maintainer, I want retired runtime directories and executable references removed so that the repository matches the deployed five-application design.

#### AC-104 — Retired application roots no longer exist

- **Dado** the federated platform repository
- **Quando** application roots and Nx projects are enumerated
- **Então** Commerce subgraph, Stock worker, and obsolete PoC directories are absent

#### AC-105 — Active automation does not depend on retired sources

- **Dado** repository tests, probes, Compose, and infrastructure definitions
- **Quando** active quality and delivery commands execute
- **Então** none imports, builds, or deploys Commerce subgraph or Stock worker sources

#### AC-106 — Supported project gates remain green

- **Dado** the reduced Nx project graph
- **Quando** lint, test, build, typecheck, specification verification, and audit run
- **Então** all supported projects pass without retired compatibility suites

## Fora de escopo

- Replacing historical prose that clearly identifies superseded architecture.
- Changing behavior owned by WordPress Federation or Payment Federation.
- Removing reproducible WordPress integration fixtures.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-036 | Historical tests whose only purpose is executing retired source can be removed instead of migrated. | confirmada | The user explicitly requested removal of directories that no longer belong to the project. |

## Perguntas em aberto

Nenhuma.
