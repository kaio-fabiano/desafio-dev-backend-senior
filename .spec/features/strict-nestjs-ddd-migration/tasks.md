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
- Arquivos: libs/platform/nest/src/oauth-resource, libs/platform/nest/src/index.ts, libs/platform/nest/src/oauth-resource/graphql/required-scopes.metadata.ts, libs/platform/nest/src/oauth-resource/oauth-claims.ts, libs/platform/nest/src/oauth-resource/oauth-graphql-context.ts, libs/platform/nest/src/oauth-resource/oauth-http-request.ts, libs/platform/nest/src/oauth-resource/verification/oauth-authentication-messages.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-subject.decorator.spec.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-request.adapter.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Split OAuth options, claims, request/context data, credential errors, request adapter behavior, metadata/decorator artifacts, and injection contracts. Preserve the public package API and NestJS module behavior.

## T-212 — Migrate the Gateway NestJS edge [concluida]
- Refs: US-120, US-121, AC-256, AC-257, AC-258
- Arquivos: libs/gateway/nest/src, apps/gateway/src, apps/gateway/src/subscriptions/gateway-sse.options.ts, libs/gateway/nest/src/auth/authentication-principal.ts, libs/gateway/nest/src/auth/commerce-cookie-policy.ts, libs/gateway/nest/src/auth/commerce-session-headers.ts, libs/gateway/nest/src/auth/commerce-session-request-headers.ts, libs/gateway/nest/src/auth/commerce-session-response-headers.ts, libs/gateway/nest/src/auth/gateway-authentication.configuration.ts, libs/gateway/nest/src/auth/gateway-jwt-header-validator.ts, libs/gateway/nest/src/auth/gateway-request.ts, libs/gateway/nest/src/auth/gateway-unauthenticated.error.ts, libs/gateway/nest/src/federation/federation-capabilities.ts, libs/gateway/nest/src/federation/gateway-federation.configuration.ts, libs/gateway/nest/src/federation/set-cookie-values.ts, libs/gateway/nest/src/auth/auth-context.factory.spec.ts, libs/gateway/nest/src/auth/gateway-auth.module.spec.ts, libs/gateway/nest/src/auth/gateway-context.spec.ts, libs/gateway/nest/src/auth/gateway-request.adapter.spec.ts, libs/gateway/nest/src/auth/token-verifier.service.spec.ts, libs/gateway/nest/src/federation/authenticated-data-source.spec.ts, libs/gateway/nest/src/gateway-path.integration.spec.ts, libs/gateway/nest/src/gateway.module.spec.ts, libs/gateway/nest/src/node-review-tooling.spec.ts, apps/gateway/src/decorator-runtime.spec.ts, test/oauth-resource-server-auth.spec.test.mjs, test/gateway-federation-refactor.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Separate context/request data, cookie policy, request conversion, federation configuration, subscription client/handler, resolvers or middleware, and module composition. Keep Gateway as an edge context with no business-domain persistence.

## T-213 — Migrate the Identity NestJS bounded context [concluida]
- Refs: US-120, US-121, AC-256, AC-257, AC-258
- Arquivos: libs/identity/nest/src, apps/identity-subgraph/src, libs/identity/nest/src/better-auth/identity-auth-provider.provider.ts, libs/identity/nest/src/better-auth/identity-auth-providers.module.ts, libs/identity/nest/src/better-auth/identity-auth-token.provider.ts, libs/identity/nest/src/better-auth/identity-auth.types.d.ts, libs/identity/nest/src/better-auth/identity-database-pool.provider.ts, libs/identity/nest/src/graphql/identity-user.types.d.ts, libs/identity/nest/src/graphql/pending-load.types.d.ts, libs/identity/nest/src/graphql/user-cursor.decoder.ts, libs/identity/nest/src/graphql/user-cursor.encoder.ts, libs/identity/nest/src/oauth-issuer/oauth-client.types.d.ts, libs/identity/nest/src/oauth-issuer/oauth-error-code.d.ts, libs/identity/nest/src/registration/identity-bootstrap.ts, libs/identity/nest/src/registration/registration.types.d.ts, libs/identity/nest/src/wordpress/wordpress-configuration.provider.ts, libs/identity/nest/src/wordpress/wordpress-error-code.d.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/better-auth/better-auth.module.integration.spec.ts, libs/identity/nest/src/graphql/identity.graphql.integration.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-client-provisioning.service.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-issuer.module.spec.ts, libs/identity/nest/src/registration/registration-compensation.service.spec.ts, libs/identity/nest/src/registration/registration.module.spec.ts, libs/identity/nest/src/registration/registration.service.spec.ts, libs/identity/nest/src/wordpress/wordpress-identity.service.spec.ts, libs/identity/nest/src/wordpress/wordpress.module.spec.ts, test/identity-federation-refactor.test.mjs, test/wordpress-registration-graphql.contract.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Separate Better Auth configuration/factory responsibilities, OAuth resources, registration commands/results/errors, compensation, WordPress adapters, GraphQL DTOs, cursor behavior, and composition while preserving Better Auth as the identity source of truth.

## T-216 — Remove the in-scope legacy baseline and close all migration gates [pendente]
- Refs: US-121, AC-258, AC-259
- Arquivos: libs/platform/nest/src/oauth-resource/verification/oauth-request.adapter.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.ts, libs/platform/nest/src/index.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts, libs/gateway/nest/src/auth/auth-context.factory.ts, apps/order-workflow-subgraph/src/graphql/sse/sse-handler.ts, tools/architecture/strict-ddd-scanner.mjs, tools/architecture/strict-ddd-legacy-baseline.json, test/strict-ddd-architecture.test.mjs, docs/standards/strict-nestjs-ddd.md, docs/domain/context-map.md, docs/prds/01-arquitetura-e-dominio.md, graphify-out/graph.json, graphify-out/GRAPH_REPORT.md, graphify-out/graph.html
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Require an empty Platform, Gateway, and Identity baseline. Order Workflow may receive only the explicitly authorized mechanical replacement of `toOAuthRequest` and `isOAuthCredentialError` calls with their class-based equivalents; its business behavior remains excluded. Run build/typecheck/lint/unit/integration/contract/end-to-end/coverage gates, regenerate Graphify, run specification verification and CI audit, and publish the final migration evidence.
