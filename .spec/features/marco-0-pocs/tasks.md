# Tasks: Milestone 0 — Compatibility proofs

> feature: marco-0-pocs

## T-003 — Prepare the minimum PoC harness [concluida]

- Refs: US-004, AC-008
- Arquivos: package.json, pnpm-lock.yaml, pnpm-workspace.yaml, nx.json, tsconfig.base.json, onpspec.config.json, apps/e2e/project.json, test/marco-0-workspace.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Execute first. Preserve Nx-inferred targets and add only the configuration required for installation and project discovery.

## T-004 — Validate graphql-sse in the federated gateway [concluida]

- Refs: US-005, AC-009, AC-010
- Arquivos: test/fixtures/federated-sse-probe.ts, apps/gateway/src/subscriptions/sse-handler.ts, test/marco-0-sse.test.mjs, docs/adrs/001-graphql-sse-federado.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Execute after T-003. The proof must decide between direct support and the smallest verifiable alternative pipeline.

## T-005 — Validate the Better Auth token at the gateway and MCP [concluida]

- Refs: US-006, AC-011, AC-012
- Arquivos: test/fixtures/auth-server.ts, apps/identity-subgraph/src/auth/config.ts, libs/gateway/nest/src/auth/token-verifier.service.ts, test/marco-0-auth.test.mjs, docs/adrs/002-oauth-multi-resource.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Execute after T-003; never accept audience or scope through a permissive fallback.

## T-006 — Validate WordPress plugin composition [concluida]

- Refs: US-007, AC-013, AC-014
- Arquivos: apps/wordpress-integration/package.json, apps/wordpress-integration/project.json, apps/wordpress-integration/compose.yaml, apps/wordpress-integration/scripts/install-plugins.sh, apps/wordpress-integration/scripts/probe.mjs, apps/wordpress-integration/fixtures/products.json, test/marco-0-wordpress.test.mjs, docs/adrs/003-wordpress-federation.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Execute after T-003; use plugin-first, and introduce a wrapper only if the proof records the gap.

## T-007 — Pin versions, deadline, and decisions in ADRs [concluida]

- Refs: US-008, AC-015, AC-016
- Arquivos: docs/adrs/README.md, docs/adrs/004-restricoes-de-entrega.md, docs/prds/08-riscos-e-decisoes-pendentes.md, test/marco-0-decisions.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Consolidate after T-004, T-005, and T-006; Q-002 confirms 2026-09-03 as a date-only deadline.
