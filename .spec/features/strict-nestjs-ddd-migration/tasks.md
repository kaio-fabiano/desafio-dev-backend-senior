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

## T-216 — Replace the partial scanner with a truthful repository inventory [concluida]
- Refs: US-122, AC-260, AC-261
- Arquivos: tools/architecture, test/strict-ddd-architecture.test.mjs, test/fixtures/strict-ddd, docs/standards/strict-nestjs-ddd.md, docs/domain/context-map.md, .spec/constituicao.md, AGENTS.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Follow Red, Green, Refactor. Prove first that unlayered business orchestration and unclassified production files fail. Replace the three-root/folder-substring policy with an explicit repository classification covering every project-owned path except `apps/order-workflow-subgraph` and `apps/payment-federation`. Ignore generated sources, dependencies, caches, and build outputs explicitly. Recompute a truthful shrinking baseline and do not edit either excluded application.

## T-217 — Extract the framework-independent Identity core [concluida]
- Refs: US-120, US-123, US-126, AC-256, AC-257, AC-262, AC-268
- Arquivos: libs/identity, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Preserve the owner's existing uncommitted Identity edits. Follow characterization-first Red, Green, Refactor. Identify the actual Identity aggregate or explicitly document where a use case has no aggregate. Extract registration and client-provisioning use cases, immutable domain/application data classes, domain errors, policies, and abstract-class ports with no NestJS, Better Auth, WordPress, GraphQL, database, or transport imports. Do not introduce generic repositories, buses, base entities, or empty layer folders.

## T-218 — Rebuild Identity adapters, presentation, and NestJS composition [concluida]
- Refs: US-123, US-126, AC-263, AC-268
- Arquivos: libs/identity/nest/src, apps/identity-subgraph/src, test/identity-federation-refactor.test.mjs, test/wordpress-registration-graphql.contract.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Depends on T-217. Follow Red, Green, Refactor. Make Better Auth, WordPress, database, OAuth issuer, and cursor implementations concrete adapters for the Identity application ports. Keep GraphQL and HTTP classes in presentation, make endpoints delegate to use cases, translate errors only at the boundary, and keep `apps/identity-subgraph` limited to bootstrap, health delivery, and composition. Preserve all public authentication and registration behavior.

## T-219 — Separate Platform authorization policy from NestJS adapters [concluida]
- Refs: US-120, US-124, US-126, AC-256, AC-257, AC-264, AC-268
- Arquivos: libs/platform, test/oauth-resource-server-auth.spec.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Follow Red, Green, Refactor. Extract framework-independent claims, required-scope policy, credential errors, verification orchestration, and abstract ports where they express stable access-control concepts. Keep decorators, guards, request conversion, vendor verification, providers, and modules in the NestJS adapter. Preserve the public package API where compatibility requires it and avoid inventing an aggregate for a stateless policy.

## T-220 — Refactor the Gateway as a thin Clean Architecture edge [concluida]
- Refs: US-120, US-124, US-126, AC-256, AC-265, AC-268
- Arquivos: libs/gateway, apps/gateway/src, test/gateway-federation-refactor.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Depends on T-219. Follow Red, Green, Refactor. Separate authentication/federation/SSE orchestration and abstract ports from cookie, JWT, Apollo federation, HTTP, and subscription client adapters. Keep controllers and middleware thin and the app root limited to bootstrap, health delivery, and composition. Treat Order Workflow only as an external public contract; do not edit `apps/order-workflow-subgraph` or model its transitional business behavior.

## T-221 — Refactor the WordPress and WooCommerce integration [concluida]
- Refs: US-125, US-126, AC-266, AC-268
- Arquivos: apps/wordpress-integration, test/wordpress-registration-graphql.contract.test.mjs, test/milestone-8-wordpress-inventory-plugin.test.mjs, test/structural-wordpress-review.test.mjs, test/wordpress-native-commerce.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Follow characterization-first Red, Green, Refactor using WordPress and WooCommerce conventions rather than NestJS file grammar. Keep plugin bootstrap and hooks thin, isolate project-owned responsibilities in namespaced classes, validate nonces/capabilities and external inputs, preserve REST and GraphQL contracts, use WooCommerce CRUD APIs with HPOS compatibility, and retain WooCommerce as cart/order source of truth. Do not implement the future checkout/order redesign or modify either excluded application.

## T-222 — Govern shared contracts and Apollo MCP as explicit boundaries [concluida]
- Refs: US-125, US-126, AC-267, AC-268
- Arquivos: libs/contracts, apps/apollo-mcp, test/milestone-6-apollo-mcp.test.mjs, test/milestone-6-mcp-config.test.mjs, test/milestone-6-mcp-operations.test.mjs, test/structural-mcp-review.test.mjs, tools/architecture/strict-ddd-legacy-baseline.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Follow Red, Green, Refactor where behavior changes. Assign schema and operation ownership, validate versioned event envelopes and GraphQL operations, detect contract drift, and keep declarative artifacts declarative. Do not wrap GraphQL, JSON, or YAML in classes and do not introduce a domain layer for static integration contracts.

## T-223 — Refactor infrastructure, deployment scripts, and end-to-end tooling [pendente]
- Refs: US-125, US-126, AC-267, AC-268
- Arquivos: infra, apps/e2e, tools, scripts, test, package.json, nx.json, tsconfig.base.json, pnpm-workspace.yaml
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Follow Red, Green, Refactor for runtime tooling changes. Classify project-owned configuration and scripts, isolate environment and secret handling, remove mixed production TypeScript declarations where applicable, and keep acceptance helpers focused and deterministic. Do not create domain aggregates, repositories, or use cases for deployment and test tooling, and do not modify generated/cache/dependency paths.

## T-224 — Close the repository-wide baseline and publish migration evidence [pendente]
- Refs: US-121, US-122, US-126, AC-258, AC-259, AC-260, AC-261, AC-269
- Arquivos: tools/architecture/strict-ddd-legacy-baseline.json, test/strict-ddd-architecture.test.mjs, docs/standards/strict-nestjs-ddd.md, docs/domain/context-map.md, docs/prds/01-arquitetura-e-dominio.md, graphify-out, .spec/features/strict-nestjs-ddd-migration
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Depends on T-216 through T-223. Remove the final in-scope legacy entries and prove there are no unclassified production sources. Run all affected unit and integration suites, coverage, build, typecheck, lint, contract and end-to-end tests, regenerate Graphify, refresh traceability evidence, and require successful `onp-spec verify strict-nestjs-ddd-migration` plus `onp-spec audit --ci`. The two excluded application roots must remain untouched.
