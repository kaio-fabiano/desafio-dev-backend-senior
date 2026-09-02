# Tasks: OAuth resource-server authentication

> feature: oauth-resource-server-auth

## T-133 — Model owned OAuth resources in Better Auth [concluida]
- Refs: US-087, AC-174
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/identity/nest/src/auth/better-auth.factory.ts, libs/identity/nest/src/auth/plugins/oauth-provider-plugin.factory.ts, libs/identity/nest/src/auth/resource-audiences.ts, apps/identity-subgraph/src/auth/config.ts, test/oauth-resource-server-auth.spec.test.js
- Notas: Add explicit owned-resource audiences and least-privilege scope ceilings without changing WordPress session authentication.

## T-134 — Build the shared NestJS OAuth resource module [concluida]
- Refs: US-088, AC-176
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/auth, libs/platform/nest/src/index.ts, libs/identity/nest/src/identity.module.ts, apps/identity-subgraph/src/graphql/identity.module.ts, test/oauth-resource-server-auth.spec.test.js
- Notas: Wrap Better Auth verification with injectable options, execution-context extraction, typed claims, and metadata-based scopes; do not create a second token verifier.

## T-135 — Migrate Order Workflow GraphQL and SSE authentication [concluida]
- Refs: US-088, US-090, AC-176, AC-178
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/order-workflow-subgraph/src/graphql, apps/order-workflow-subgraph/src/subscriptions, apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/project.json, test/oauth-resource-server-auth.spec.test.js, test/production-happy-path-hardening.spec.test.js
- Notas: Replace FederationAuthGuard with the shared OAuth integration while preserving SubjectOwnerGuard as bounded-context authorization.

## T-136 — Forward bearer credentials through the Gateway [concluida]
- Refs: US-087, US-090, AC-175, AC-178
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/gateway/nest/src/auth, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/gateway/nest/src/gateway.module.ts, apps/gateway/src/subscriptions, test/gateway-federation-refactor.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/oauth-resource-server-auth.spec.test.js
- Notas: Preserve the verified bearer credential and correlation metadata; retain WordPress-specific session propagation as a separate adapter concern.

## T-137 — Migrate Payment to Spring Security resource-server support [pendente]

- Refs: US-089, AC-177
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/build.gradle.kts, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/graphql, apps/payment-federation/src/main/resources/application.yaml, apps/payment-federation/src/test, test/structural-payment-review.test.mjs, test/oauth-resource-server-auth.spec.test.js
- Notas: Use Spring Security OAuth2 Resource Server and method/security context integration; remove the custom federation-secret interceptor.

## T-138 — Remove the custom trust protocol and codify native-first review [pendente]

- Refs: US-087, US-088, US-089, US-090, US-091, AC-174, AC-175, AC-176, AC-177, AC-178, AC-179
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: compose.yaml, docs/adrs, docs/prds, test, graphify-out, .spec/features/oauth-resource-server-auth, .spec/verification/oauth-resource-server-auth.json
- Notas: Remove obsolete secrets/headers from owned-service paths, document why remaining custom adapters exist, run Java tests, GraphQL composition, repository tests, ESLint, Graphify refresh, code-review loop, verify, and audit --ci.
