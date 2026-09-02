# Tasks: OAuth resource-server authentication

> feature: oauth-resource-server-auth

## T-133 — Model owned OAuth resources in Better Auth [concluida]
- Refs: US-087, AC-174
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/identity/nest/src/auth/better-auth.factory.ts, libs/identity/nest/src/auth/resource-audiences.ts, test/oauth-resource-server-auth.spec.test.mjs
- Notas: Add explicit owned-resource audiences and least-privilege scope ceilings without changing WordPress session authentication.

## T-134 — Build the shared NestJS OAuth resource module [concluida]
- Refs: US-088, AC-176
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/auth/oauth-resource.module.ts, libs/platform/nest/src/auth/oauth-resource.service.ts, libs/platform/nest/src/auth/oauth-resource.guard.ts, libs/platform/nest/src/index.ts, libs/identity/nest/src/identity.module.ts, test/oauth-resource-server-auth.spec.test.mjs
- Notas: Wrap Better Auth verification with injectable options, execution-context extraction, typed claims, and metadata-based scopes; do not create a second token verifier.

## T-135 — Migrate Order Workflow GraphQL and SSE authentication [concluida]
- Refs: US-088, US-090, AC-176, AC-178
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/order-workflow-subgraph/src/graphql, apps/order-workflow-subgraph/src/subscriptions, apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/project.json, test/oauth-resource-server-auth.spec.test.mjs, test/production-happy-path-hardening.spec.test.js
- Notas: Replace FederationAuthGuard with the shared OAuth integration while preserving SubjectOwnerGuard as bounded-context authorization.

## T-136 — Forward bearer credentials through the Gateway [concluida]
- Refs: US-087, US-090, AC-175, AC-178
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/gateway/nest/src/auth, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/gateway/nest/src/gateway.module.ts, apps/gateway/src/subscriptions, test/gateway-federation-refactor.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/oauth-resource-server-auth.spec.test.mjs
- Notas: Preserve the verified bearer credential and correlation metadata; retain WordPress-specific session propagation as a separate adapter concern.

## T-137 — Migrate Payment to Spring Security resource-server support [concluida]
- Refs: US-089, AC-177
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/build.gradle.kts, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/graphql, apps/payment-federation/src/main/resources/application.yaml, apps/payment-federation/src/test, test/structural-payment-review.test.mjs, test/oauth-resource-server-auth.spec.test.mjs
- Notas: Use Spring Security OAuth2 Resource Server and method/security context integration; remove the custom federation-secret interceptor.

## T-138 — Remove the custom trust protocol and codify native-first review [concluida]
- Refs: US-087, US-088, US-089, US-090, US-091, AC-174, AC-175, AC-176, AC-177, AC-178, AC-179
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: compose.yaml, docs/adrs, docs/prds, test, graphify-out, .spec/features/oauth-resource-server-auth, .spec/verification/oauth-resource-server-auth.json
- Notas: Remove obsolete secrets/headers from owned-service paths, document why remaining custom adapters exist, run Java tests, GraphQL composition, repository tests, ESLint, Graphify refresh, code-review loop, verify, and audit --ci.

## T-139 — Preserve OAuth request proof and separate scope authorization [concluida]
- Refs: US-092, AC-180, AC-181
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/auth/oauth-resource.service.ts, libs/platform/nest/src/auth/oauth-resource.guard.ts, libs/platform/nest/src/auth/oauth-resource.module.ts, libs/platform/nest/src/index.ts, test/oauth-resource-server-auth.spec.test.mjs
- Notas: Preserve the externally visible request method and URL for Better Auth DPoP verification, keep token verification in the service, enforce resolver scopes in the GraphQL guard, and distinguish unauthorized from forbidden outcomes.

## T-140 — Remove duplicated GraphQL authentication state and decorators [concluida]
- Refs: US-092, AC-181, AC-183
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/order-workflow-subgraph/src/graphql/authenticated-subject.decorator.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts, apps/order-workflow-subgraph/src/graphql/order-workflow.module.ts, libs/identity/nest/src/identity.module.ts, test/oauth-resource-server-auth.spec.test.mjs
- Notas: Use the shared OAuth subject decorator, keep only workflow-session extraction locally, and make the GraphQL-only guard specialization explicit at every consumer.

## T-141 — Consolidate Gateway verification on the shared OAuth service [concluida]
- Refs: US-092, AC-182
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/gateway/nest/src/auth/token-verifier.service.ts, libs/gateway/nest/src/auth/auth-context.factory.ts, libs/gateway/nest/src/gateway.module.ts, libs/platform/nest/src/auth/oauth-resource.service.ts, test/gateway-federation-refactor.test.mjs, test/oauth-resource-server-auth.spec.test.mjs
- Notas: Remove the second issuer/audience/lifetime verification policy while retaining Gateway correlation identifiers and typed custom-claim enrichment.

## T-142 — Simplify Better Auth composition and close quality gates [concluida]
- Refs: US-092, AC-183
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/identity/nest/src/auth/better-auth.factory.ts, libs/identity/nest/src/auth/better-auth.module.ts, libs/identity/nest/src/auth/resource-audiences.ts, libs/identity/nest/src/graphql/identity.resolver.ts, libs/identity/nest/src/index.ts, test/identity-federation-refactor.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, .spec/features/federated-platform-architecture-refactor/spec.md, .spec/features/oauth-resource-server-auth, .spec/verification/oauth-resource-server-auth.json
- Notas: Call Better Auth plugin constructors directly, remove forwarding-only providers, run TypeScript, ESLint, focused and repository tests, the code-review loop, onp-spec verify, and onp-spec audit --ci.

## T-143 — Repair canonical CI compatibility [concluida]
- Refs: US-092, AC-176, AC-179, AC-184
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/auth/oauth-resource.module.ts, libs/identity/nest/src/auth/better-auth.factory.ts, libs/identity/nest/src/auth/resource-audiences.ts, libs/contracts/graphql/order-workflow/schema.graphql, apps/payment-federation/Dockerfile, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/persistence/JdbcPaymentRepository.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/ArchitectureBoundariesTest.java, apps/gateway/Dockerfile, apps/identity-subgraph/Dockerfile, apps/order-workflow-subgraph/Dockerfile, apps/order-workflow-subgraph/src/checkout, apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts, apps/order-workflow-subgraph/src/outbox/outbox.repository.ts, apps/e2e/src/journey.ts, apps/e2e/src/milestone-7.e2e.test.ts, compose.yaml, test/delivery-closure-rabbitmq.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, test/payment-federation-clean-architecture.spec.test.mjs, test/production-happy-path-hardening.spec.test.js, test/structural-commerce-review.test.mjs, graphify-out, .spec/features/oauth-resource-server-auth, .spec/verification/oauth-resource-server-auth.json
- Notas: Preserve NestJS module metadata without unsupported decorator syntax, give the structural Java test its actual unique name, run the exact failing Nx targets locally, refresh Graphify after commit, and require the fork PR CI to pass before merge.
