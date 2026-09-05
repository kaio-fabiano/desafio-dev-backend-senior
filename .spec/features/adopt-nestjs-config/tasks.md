# Tasks: Adopt NestJS Config

> feature: adopt-nestjs-config

## T-176 — Replace custom environment plumbing with NestJS Config [concluida]
- Refs: US-106, AC-216, AC-217, AC-218
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: package.json, pnpm-lock.yaml, libs/platform/nest/src/index.ts, apps/gateway/src/app.module.ts, apps/gateway/src/main.ts, apps/identity-subgraph/src/app.module.ts, apps/identity-subgraph/src/main.ts, apps/order-workflow-subgraph/src/app.module.ts, apps/order-workflow-subgraph/src/main.ts, test/nest-provider-composition.test.mjs, test/adopt-nestjs-config.test.mjs, vitest.config.ts, .spec/features/adopt-nestjs-config/evidence/tdd.md
- Notas: Use `@nestjs/config` directly, configure it globally once per NestJS application, migrate bootstrap ports through ConfigService without changing their name or default, remove the unused custom environment abstraction, leave feature-owned configuration for each owning module review, add no schema-validation dependency, and close with focused tests, coverage, typecheck, lint, verify, and audit.
