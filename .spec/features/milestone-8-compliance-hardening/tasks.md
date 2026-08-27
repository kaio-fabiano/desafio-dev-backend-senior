# Tasks: Milestone 8 — Challenge compliance and production hardening

> feature: milestone-8-compliance-hardening

## T-053 — Establish the honest compliance gate [concluida]
- Refs: US-040, US-043, US-044, AC-078, AC-079, AC-085, AC-086, AC-087, AC-088
- Arquivos: docs/evidence/milestone-8/review.md, docs/evidence/milestone-8/requirements.md, test/milestone-8-compliance-contract.test.mjs, test/milestone-8-compliance-hardening.spec.test.js, onpspec.config.json
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notes: Encode the review gaps before implementation. Source-shape assertions cannot replace runtime proofs.

## T-054 — Repair the reproducible Nx quality toolchain [concluida]
- Refs: US-043, AC-085, AC-086
- Arquivos: eslint.config.mjs, package.json, pnpm-lock.yaml, nx.json, apps/payment-processor/project.json, test/milestone-8-quality-gate.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Configure TypeScript linting and make Java builds independent of globally installed Gradle.

## T-055 — Complete Identity and Gateway federation runtime [concluida]
- Refs: US-041, AC-080, AC-081, AC-082, AC-086
- Arquivos: libs/contracts/graphql/identity/schema.graphql, libs/contracts/graphql/supergraph.yaml, apps/identity-subgraph/src, apps/gateway/src, apps/identity-subgraph/project.json, apps/gateway/project.json, test/milestone-8-identity-gateway.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Mount schema-first GraphQL, Better Auth, persistence, ownership policy, request-scoped loaders, and reference resolvers.

## T-056 — Complete Commerce runtime composition [concluida]
- Refs: US-042, US-043, AC-083, AC-086
- Arquivos: libs/contracts/graphql/commerce/schema.graphql, apps/commerce-subgraph/src, apps/commerce-subgraph/project.json, test/milestone-8-commerce-runtime.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Wire existing cart, checkout, reconciliation, saga, outbox, inbox, and SSE components; add no decorative interfaces.

## T-057 — Complete payment and inventory worker runtime [concluida]
- Refs: US-042, AC-084, AC-085, AC-086
- Arquivos: apps/payment-processor/src, apps/payment-processor/build.gradle.kts, apps/stock-worker/src, apps/stock-worker/project.json, test/milestone-8-worker-runtime.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Preserve database idempotency, explicit acknowledgements, retry/DLQ, and graceful shutdown.

## T-058 — Replace the simulated E2E with the delivered system [concluida]
- Refs: US-040, US-041, US-042, AC-078, AC-079, AC-080, AC-081, AC-082, AC-083, AC-084
- Arquivos: apps/e2e/src/environment.ts, apps/e2e/src/journey.ts, apps/e2e/src/milestone-7.e2e.test.ts, apps/e2e/project.json, apps/identity-subgraph/project.json, apps/gateway/project.json, apps/commerce-subgraph/project.json, apps/stock-worker/project.json, apps/payment-processor/build.gradle.kts, compose.yaml, test/milestone-7-e2e-contract.test.mjs, test/milestone-8-real-e2e.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Depends on T-055 through T-057. Build and run the actual images and assert through public protocols only.

## T-059 — Retire obsolete PoC project structure [concluida]
- Refs: US-043, AC-087
- Arquivos: apps/poc-auth, apps/poc-sse, apps/poc-harness, apps/poc-wordpress, apps/wordpress-integration, apps/e2e/project.json, docs/adrs, docs/runbooks, test/marco-0-auth.test.mjs, test/marco-0-sse.test.mjs, test/marco-0-wordpress.test.mjs, pnpm-workspace.yaml, pnpm-lock.yaml
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Preserve useful fixtures, rename the active WordPress integration, and delete only duplicated applications after replacement proofs pass.

## T-060 — Harden offline SST and delivery documentation [concluida]
- Refs: US-044, AC-088
- Arquivos: infra/sst.config.ts, infra/tsconfig.json, .github/workflows/ci.yml, .github/workflows/deploy.yml, docs/runbooks/deployment.md, test/milestone-8-offline-infra.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notes: Make no AWS mutations. Validate configuration and policy offline; keep deployment protected and credentialed.
