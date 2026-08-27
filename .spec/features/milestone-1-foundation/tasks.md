# Tasks: Milestone 1 — Monorepo foundation and contracts

> feature: milestone-1-foundation

## T-008 — Close the audited baseline [pendente]

- Refs: US-009, AC-017
- Arquivos: .spec/features/marco-0-pocs/spec.md, .spec/constituicao.md, test/milestone-1-baseline.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Mechanical correction only; do not change the meaning of either principle.

## T-009 — Establish Nx project boundaries and shared dependencies [pendente]

- Refs: US-010, AC-018
- Arquivos: package.json, pnpm-lock.yaml, nx.json, eslint.config.mjs, tools/generators/project/index.mjs, tools/generators/project/schema.json, test/milestone-1-boundaries.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Execute before T-010 through T-013. Prefer Nx-native tags and constraints; install all Milestone 1 dependencies here so later tasks remain disjoint.

## T-010 — Create operational service skeletons [pendente]

- Refs: US-011, AC-019
- Arquivos: apps/gateway/project.json, apps/gateway/src/main.ts, apps/gateway/src/app.module.ts, apps/gateway/src/health.controller.ts, apps/identity-subgraph/project.json, apps/identity-subgraph/src/main.ts, apps/identity-subgraph/src/app.module.ts, apps/identity-subgraph/src/health.controller.ts, apps/commerce-subgraph/project.json, apps/commerce-subgraph/src/main.ts, apps/commerce-subgraph/src/app.module.ts, apps/commerce-subgraph/src/health.controller.ts, test/milestone-1-health.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Execute after T-009. Reuse one minimal app pattern without introducing a framework wrapper library.

## T-011 — Define and compose GraphQL contracts [pendente]

- Refs: US-012, AC-020
- Arquivos: libs/contracts/graphql/identity/schema.graphql, libs/contracts/graphql/catalog/schema.graphql, libs/contracts/graphql/commerce/schema.graphql, libs/contracts/graphql/supergraph.yaml, test/milestone-1-graphql-contracts.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Execute after T-009. Use the entity ownership already documented in the federation PRD and ADR 003.

## T-012 — Define the common event envelope [pendente]

- Refs: US-013, AC-021
- Arquivos: libs/contracts/events/envelope.schema.json, libs/contracts/events/checkout-requested.v1.schema.json, libs/contracts/events/payment-authorized.v1.schema.json, libs/contracts/events/payment-failed.v1.schema.json, test/milestone-1-events.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Execute after T-009. Use JSON Schema and the already-installed validator selected in T-009; no custom validation framework.

## T-013 — Assemble the reproducible foundation gate [pendente]

- Refs: US-014, AC-022, AC-023
- Arquivos: compose.yaml, test/milestone-1-foundation.test.mjs, test/milestone-1-infrastructure.test.mjs, docs/runbooks/milestone-1-foundation.md, onpspec.config.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Execute after T-010 through T-012. Keep infrastructure minimal and verify readiness by a real command/query rather than TCP alone.
