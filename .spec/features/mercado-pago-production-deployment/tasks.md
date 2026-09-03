# Tasks: Mercado Pago production deployment

> feature: mercado-pago-production-deployment

## T-146 — Run and repair the complete credential-free quality gate [concluida]
- Refs: US-094, AC-187, AC-188
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: package.json, apps/e2e/project.json, test/mercado-pago-production-deployment.test.mjs, docs/evidence/mercado-pago-production-deployment/credential-free-gate.md
- Notas: Run all existing suites first, make only root-cause fixes required by failures, reject skipped tests, and record the exact Git revision and commands.

## T-147 — Automate redacted Mercado Pago test-environment verification [concluida]
- Refs: US-095, AC-189, AC-190
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/e2e/src/mercado-pago-sandbox.test.ts, apps/e2e/src/mercado-pago-sandbox.ts, apps/e2e/project.json, docs/runbooks/mercado-pago-sandbox.md, test/mercado-pago-production-deployment.test.mjs
- Notas: Keep the credentialed target opt-in, require explicit environment inputs, use unique operation keys, never print secrets or raw payloads, and verify no second provider operation is created.

## T-148 — Complete secret-backed SST runtime and deployment checks [concluida]
- Refs: US-096, AC-191, AC-192
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: infra/sst.config.ts, infra/package.json, apps/payment-federation/Dockerfile, apps/order-workflow-subgraph/Dockerfile, apps/gateway/Dockerfile, apps/identity-subgraph/Dockerfile, apps/apollo-mcp/Dockerfile, test/mercado-pago-production-deployment.test.mjs, docs/runbooks/deployment.md
- Notas: Represent the complete required topology, bind managed secrets to Payment Federation, expose only required entry points, validate and diff before any deploy, and preserve production protection.

## T-149 — Deploy the approved stage and run release smoke tests [pendente]

- Refs: US-095, US-096, AC-189, AC-190, AC-192, AC-193
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: docs/evidence/mercado-pago-production-deployment/deployment.json, docs/evidence/mercado-pago-production-deployment/provider-sandbox.json, docs/evidence/mercado-pago-production-deployment/smoke-test.md
- Notas: This task starts only after the owner approves the exact stage and reviewed SST diff. Store redacted evidence, execute the credentialed provider checks, and roll back on a critical smoke failure.
