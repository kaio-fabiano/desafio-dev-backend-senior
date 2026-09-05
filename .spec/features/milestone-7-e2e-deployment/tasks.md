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
- Arquivos: nx.json, package.json, apps/gateway/project.json, apps/identity-subgraph/project.json, apps/payment-federation/project.json, test/milestone-7-nx-quality.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Reuse Nx targets and native dynamic output; add no custom TUI and no duplicate task runner.

## T-048 — Harden final application images and Compose readiness [concluida]
- Refs: US-037, US-038, AC-067, AC-075
- Arquivos: compose.yaml, apps/gateway/Dockerfile, apps/identity-subgraph/Dockerfile, apps/payment-federation/Dockerfile, apps/apollo-mcp/Dockerfile, test/milestone-6-mcp-config.test.mjs, test/milestone-7-containers.test.mjs
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

## T-145 — Execute the final challenge handoff [concluida]
- Refs: AC-067, AC-068, AC-069, AC-070, AC-071, AC-072, AC-073, AC-074, AC-075, AC-076, AC-077
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: README.md, docs/evidence/challenge-compliance.md, docs/runbooks/e2e.md, .spec/features/milestone-7-e2e-deployment/tasks.md, .spec/verification/milestone-7-e2e-deployment.json, graphify-out
- Notes: Run the complete public-protocol Testcontainers journey and every repository quality gate before changing delivery evidence. Preserve all production-readiness gaps, push only to the user fork, open the pull request against the fork main branch, wait for CI, and merge only when required checks pass.

## T-146 — Stabilize the CI acceptance environment [concluida]
- Refs: AC-067, AC-068, AC-069, AC-070, AC-071, AC-075
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/e2e/src/environment.ts, compose.yaml, apps/wordpress-integration/scripts/production-entrypoint.sh, libs/identity/nest/src/better-auth/better-auth.factory.ts, apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts, apps/order-workflow-subgraph/src/order-events/postgres/postgres-order-event.relay.ts, test/milestone-7-e2e-contract.test.mjs, test/mercado-pago-production-deployment.test.mjs, .spec/features/milestone-7-e2e-deployment/tasks.md, .spec/verification/milestone-7-e2e-deployment.json, graphify-out
- Notes: Diagnose the repeatable CI-only startup failure, preserve production-equivalent service behavior, emit actionable container diagnostics, and merge the fork pull request only after all required checks pass.
## T-207 — Restore executable E2E bootstrap [pendente]

- Refs: AC-067, AC-075
- Modelo: gpt-5.6-terra
- Esforço: medio
- Arquivos: test/milestone-7-e2e-contract.test.mjs, vitest.config.ts, compose.yaml, .spec/features/milestone-7-e2e-deployment/tasks.md, .spec/verification/milestone-7-e2e-deployment.json
- Notes: Add focused contract coverage that the canonical Vitest target selects the acceptance file and Compose preserves the decorator-capable Docker image commands; make the minimum configuration correction and rerun the complete isolated journey.
