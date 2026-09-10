# Tasks: Harden OAuth runtime configuration

> feature: harden-oauth-runtime-configuration

## T-268 — Align OAuth defaults and resolve configuration lazily [concluida]
- Refs: US-140, AC-305
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts, libs/gateway/nest/src/auth/gateway-auth.module.ts, libs/gateway/nest/src/auth/gateway-auth.module.spec.ts, libs/identity/nest/src/identity.module.ts, test/harden-oauth-runtime-configuration.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-268.md
- Notas: Follow Red, Green, Refactor. Bounded contexts: Identity issuer and Edge authentication. Use case: build resource-server configuration after Nest config loading. Aggregate: none; this is composition-time configuration. Invariants: Identity and Gateway default to the same issuer; explicit configuration wins; malformed URLs still fail closed. Consistency boundary: one Nest application bootstrap. Affected ports: none. Add `registerAsync` by extending the existing dynamic module; add no configuration library.

## T-269 — Separate OAuth request orchestration from vendor verification [pendente]

- Refs: US-142, AC-308
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.ts, libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.integration.spec.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts, test/harden-oauth-resource-service.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-269.md
- Notas: Run after T-268 and follow Red, Green, Refactor. Bounded context: shared OAuth resource technical boundary. Use case: verify one OAuth credential and map it to owned claims. Aggregate: none; verification is stateless. Invariants: Better Auth remains the only cryptographic authority; the adapter implements `OAuthCredentialVerifierPort`; `OAuthResourceService` consumes the use case and never implements the port; credential errors and critical coverage remain unchanged. Consistency boundary: one request verification. Affected ports: `OAuthCredentialVerifierPort`.

## T-270 — Add canonical and replay-safe Gateway DPoP configuration [pendente]

- Refs: US-141, AC-306, AC-307
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: package.json, pnpm-lock.yaml, infra/sst.config.ts, libs/platform/nest/src/oauth-resource/oauth-resource.types.ts, libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.ts, libs/platform/nest/src/oauth-resource/infrastructure/better-auth-oauth-credential-verifier.adapter.spec.ts, libs/gateway/nest/src/auth/gateway-auth.module.ts, libs/gateway/nest/src/auth/gateway-auth.module.spec.ts, libs/gateway/nest/src/infrastructure/auth/dynamo-dpop-replay.store.ts, libs/gateway/nest/src/infrastructure/auth/dynamo-dpop-replay.store.spec.ts, test/production-deployment.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-270.md
- Notas: Run after T-269 and follow Red, Green, Refactor. Bounded context: Edge authentication. Use case: atomically reserve DPoP proof identifiers and verify the proof against the canonical request target. Aggregate: none; this is an expiring security tombstone. Invariants: one replay key succeeds once across instances; `htu` uses the public Gateway origin; production fails closed without shared replay configuration; Bearer remains supported. Consistency boundary: one conditional shared-store reservation. Affected ports: Better Auth `DpopReplayStore`. Use the existing AWS deployment boundary and Better Auth 1.7.1 contract; do not create a generic cache abstraction.

## T-271 — Enforce Identity query visibility and use the production batch provider [pendente]

- Refs: US-143, AC-309, AC-310, AC-311, AC-312
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/identity/nest/src/application/policies/identity-user-visibility.policy.ts, libs/identity/nest/src/application/policies/identity-user-visibility.policy.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-resources.ts, libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/graphql/identity.resolver.ts, libs/identity/nest/src/graphql/identity.resolver.spec.ts, libs/identity/nest/src/graphql/identity.graphql.integration.spec.ts, libs/identity/nest/src/infrastructure/persistence/better-auth-identity-user.adapter.ts, libs/identity/nest/src/infrastructure/persistence/better-auth-identity-user.adapter.spec.ts, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/graphql/user.loader.ts, libs/identity/nest/src/graphql/user.repository.ts, test/graphql-relay-dataloader-closure.test.mjs, test/identity-federation-refactor.test.mjs, test/idiomatic-nestjs-architecture.test.mjs, docs/evidence/harden-oauth-runtime-configuration/T-271.md
- Notas: Follow Red, Green, Refactor after ASM-114 and ASM-115 are confirmed. Bounded context: Identity. Use case: list users administratively and find only a self-visible or administratively visible user. Aggregate: none; Better Auth remains authoritative for user reads. Invariants: ordinary scopes cannot enumerate users or email addresses; self and `me` remain visible; cross-user denial is indistinguishable from absence; batching is request-scoped; PageInfo derives from stored rows. Consistency boundary: one Identity GraphQL request and its Better Auth read snapshot. Affected ports: `IdentityUserQueryPort`. Delete the two compatibility aliases; add no role framework or DataLoader dependency.

## T-272 — Correct OAuth audience and DPoP presentation guidance [pendente]

- Refs: US-144, AC-313
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: README.md, docs/prds/03-identidade-e-oauth.md, docs/evidence/harden-oauth-runtime-configuration/presentation.md, test/harden-oauth-runtime-configuration.test.mjs
- Notas: Documentation-only and mechanical contract assertions. State that Gateway-to-Identity federation requires the Identity resource audience, Bearer is delivered, and production DPoP depends on canonical external origin plus shared replay storage. Do not claim DPoP is required for current clients.
