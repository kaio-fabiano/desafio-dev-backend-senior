# Tasks: Strict NestJS DDD migration

> feature: strict-nestjs-ddd-migration

## T-209 — Install the strict DDD governance contract [concluida]
- Refs: US-118, AC-252, AC-253
- Arquivos: AGENTS.md, .spec/constituicao.md, docs/standards/strict-nestjs-ddd.md, docs/domain/context-map.md, docs/prds/01-arquitetura-e-dominio.md, test/strict-ddd-governance.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Publish the canonical rules, add mandatory agent workflow clauses, assign new executable constitution principles, and record the strategic context map. This task changes governance only, not runtime behavior.

## T-210 — Add the TypeScript AST architecture gate and legacy baseline [concluida]
- Refs: US-119, US-120, AC-254, AC-255, AC-256, AC-257
- Arquivos: tools/architecture/strict-ddd-policy.mjs, tools/architecture/strict-ddd-scanner.mjs, tools/architecture/strict-ddd-legacy-baseline.json, test/strict-ddd-architecture.test.mjs, test/fixtures/strict-ddd/valid-use-case.ts, test/fixtures/strict-ddd/invalid-mixed-service.ts, test/fixtures/strict-ddd/valid-custom.decorator.ts, package.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Follow Red, Green, Refactor. Use the TypeScript compiler AST, report exact files/declarations, permit only dedicated-file exceptions, and reject any baseline growth. Scope the initial baseline to the stable Platform, Gateway, and Identity NestJS roots; explicitly reject Order Workflow files from this feature's task manifests.

## T-211 — Migrate the shared NestJS platform library [concluida]
- Refs: US-120, US-121, AC-256, AC-257, AC-258
- Arquivos: libs/platform/nest/src/oauth-resource, libs/platform/nest/src/index.ts, libs/platform/nest/src/**/*.spec.ts, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Split OAuth options, claims, request/context data, credential errors, request adapter behavior, metadata/decorator artifacts, and injection contracts. Preserve the public package API and NestJS module behavior.

## T-212 — Migrate the Gateway NestJS edge [pendente]

- Refs: US-120, US-121, AC-256, AC-257, AC-258
- Arquivos: libs/gateway/nest/src, apps/gateway/src, libs/gateway/nest/src/**/*.spec.ts, apps/gateway/src/**/*.spec.ts, test/oauth-resource-server-auth.spec.test.mjs, test/gateway-federation-refactor.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Separate context/request data, cookie policy, request conversion, federation configuration, subscription client/handler, resolvers or middleware, and module composition. Keep Gateway as an edge context with no business-domain persistence.

## T-213 — Migrate the Identity NestJS bounded context [pendente]

- Refs: US-120, US-121, AC-256, AC-257, AC-258
- Arquivos: libs/identity/nest/src, apps/identity-subgraph/src, libs/identity/nest/src/**/*.spec.ts, test/identity-federation-refactor.test.mjs, test/wordpress-registration-graphql.contract.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Separate Better Auth configuration/factory responsibilities, OAuth resources, registration commands/results/errors, compensation, WordPress adapters, GraphQL DTOs, cursor behavior, and composition while preserving Better Auth as the identity source of truth.

## T-216 — Remove the in-scope legacy baseline and close all migration gates [pendente]

- Refs: US-121, AC-258, AC-259
- Arquivos: tools/architecture/strict-ddd-legacy-baseline.json, test/strict-ddd-architecture.test.mjs, docs/standards/strict-nestjs-ddd.md, docs/domain/context-map.md, docs/prds/01-arquitetura-e-dominio.md, graphify-out/graph.json, graphify-out/GRAPH_REPORT.md, graphify-out/graph.html
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Require an empty Platform, Gateway, and Identity baseline, prove that this migration did not modify Order Workflow, run build/typecheck/lint/unit/integration/contract/end-to-end/coverage gates, regenerate Graphify, run specification verification and CI audit, and publish the final migration evidence.
