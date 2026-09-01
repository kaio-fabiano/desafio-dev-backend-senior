# Tasks: Milestone 7 — E2E, quality, and deployment

> feature: milestone-7-e2e-deployment

## T-046 — Trace mandatory delivery requirements [concluida]
- Refs: US-037, US-038, US-039, AC-067, AC-068, AC-069, AC-070, AC-071, AC-072, AC-073, AC-074, AC-075, AC-076, AC-077
- Arquivos: docs/evidence/milestone-7/requirements.md, test/milestone-7-delivery-contract.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notes: Build the executable requirement matrix first and distinguish mandatory gates from the optional OpenTelemetry bonus.

## T-047 — Complete the cross-language Nx quality graph [concluida]
- Refs: US-038, AC-074
- Arquivos: nx.json, package.json, apps/gateway/project.json, apps/identity-subgraph/project.json, apps/payment-processor/project.json, test/milestone-7-nx-quality.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Reuse Nx targets and native dynamic output; add no custom TUI and no duplicate task runner.

## T-048 — Harden final application images and Compose readiness [concluida]
- Refs: US-037, US-038, AC-067, AC-075
- Arquivos: compose.yaml, apps/gateway/Dockerfile, apps/identity-subgraph/Dockerfile, apps/payment-processor/Dockerfile, apps/apollo-mcp/Dockerfile, test/milestone-6-mcp-config.test.mjs, test/milestone-7-containers.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Pin images, use multi-stage builds, non-root runtime users, and readiness rather than open-port checks.

## T-049 — Implement the complete Testcontainers acceptance journey [concluida]
- Refs: US-037, AC-067, AC-068, AC-069, AC-070, AC-071
- Arquivos: package.json, pnpm-lock.yaml, onpspec.config.json, apps/e2e/project.json, apps/e2e/src/milestone-7.e2e.test.ts, apps/e2e/src/environment.ts, apps/e2e/src/journey.ts, test/milestone-7-e2e-contract.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: This is distributed authentication/payment/concurrency work. Use Vitest and Testcontainers, public Gateway/MCP interfaces only for cross-domain acceptance, and unconditional teardown.

## T-050 — Enforce coverage, P95, and N+1 budgets [concluida]
- Refs: US-038, AC-072, AC-073
- Arquivos: package.json, apps/e2e/project.json, test/milestone-7-coverage.test.mjs, test/milestone-7-load.test.mjs, docs/evidence/milestone-7/quality.md
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Use existing Node test coverage, Gradle/Jacoco, and request counters before adding dependencies. Keep the local load probe deterministic.

## T-051 — Add the pinned SST v3 stack and protected CI delivery path [concluida]
- Refs: US-039, AC-076
- Arquivos: infra/sst.config.ts, infra/package.json, infra/tsconfig.json, .github/workflows/ci.yml, .github/workflows/deploy.yml, test/milestone-7-sst.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Infrastructure and secret handling are critical. `sst diff` may run for review; deploy requires an explicitly approved credentialed environment and must never expose secrets.

## T-052 — Publish final runbooks, operation collection, and evidence index [concluida]
- Refs: US-039, AC-077
- Arquivos: README.md, docs/runbooks/local-development.md, docs/runbooks/e2e.md, docs/runbooks/deployment.md, docs/operations/marketplace.http, docs/evidence/mcp/README.md, docs/evidence/milestone-7/README.md, test/milestone-7-documentation.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notes: Link existing ADRs and evidence instead of duplicating them. Never store bearer tokens, AWS credentials, or screenshots containing secrets.
