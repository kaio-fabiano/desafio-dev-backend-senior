# Tasks: Refactor registration boundaries

> feature: refactor-registration-boundaries

The user approved `gpt-5.6-sol` with high effort for T-191 through T-199 and
sequential execution on 2026-09-05. Preserve all pre-existing user changes.
Each task follows Red, Green, and Refactor before its status changes to
completed.

## T-191 — Extract WordPress registration integration [concluida]

- Refs: US-112, AC-233, AC-234
- Arquivos: libs/identity/nest/src/wordpress/wordpress.config.ts, libs/identity/nest/src/wordpress/wordpress-identity.service.ts, libs/identity/nest/src/wordpress/wordpress-identity.service.spec.ts, libs/identity/nest/src/better-auth/better-auth.module.ts, libs/identity/nest/src/better-auth/better-auth.module.integration.spec.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Red proved ConfigService-backed provider wiring and the registration integration contract before moving configuration and remote operations into focused NestJS providers. T-197 subsequently replaced the initial WooCommerce REST protocol with native WordPress GraphQL. No gateway or port abstraction was introduced.

## T-192 — Extract compensating cleanup into a focused service [concluida]

- Refs: US-112, AC-233, AC-235
- Arquivos: libs/identity/nest/src/registration/registration-compensation.service.ts, libs/identity/nest/src/registration/registration-compensation.service.spec.ts, libs/identity/nest/src/registration/registration.error.ts, libs/identity/nest/src/better-auth/better-auth.module.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-191. Red proves ownership-aware cleanup, continuation after independent failures, and typed failure aggregation before extracting rollback from the registration orchestrator.

## T-193 — Reduce registration to hook orchestration [concluida]

- Refs: US-112, AC-233, AC-234, AC-235
- Arquivos: libs/identity/nest/src/registration/registration.service.ts, libs/identity/nest/src/registration/registration.service.spec.ts, libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/better-auth/better-auth.module.ts, libs/identity/nest/src/better-auth/better-auth.module.integration.spec.ts, libs/identity/nest/src/index.ts, test/identity-federation-refactor.test.mjs, test/structural-identity-review.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-192. Red proved unchanged success and failure behavior. Green left RegistrationService responsible only for Better Auth hook handling, signup-result extraction, registration workflow sequencing, and error translation. WordPress protocol concerns belong to WordPressIdentityService and rollback mechanics belong to RegistrationCompensationService.

## T-194 — Establish focused NestJS authentication modules [concluida]

- Refs: US-112, AC-233, AC-234, AC-235, AC-236
- Arquivos: libs/identity/nest/src/better-auth/better-auth.module.ts, libs/identity/nest/src/better-auth/better-auth.module.integration.spec.ts, libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/registration/registration.module.ts, libs/identity/nest/src/registration/registration.module.spec.ts, libs/identity/nest/src/registration/registration.service.ts, libs/identity/nest/src/registration/registration.service.spec.ts, libs/identity/nest/src/registration/registration-compensation.service.ts, libs/identity/nest/src/registration/registration-compensation.service.spec.ts, libs/identity/nest/src/wordpress/wordpress.module.ts, libs/identity/nest/src/wordpress/wordpress.module.spec.ts, libs/identity/nest/src/wordpress/wordpress.config.ts, libs/identity/nest/src/wordpress/wordpress-identity.service.ts, libs/identity/nest/src/wordpress/wordpress-identity.service.spec.ts, libs/identity/nest/src/index.ts, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/graphql/user.repository.ts, test/identity-federation-refactor.test.mjs, test/structural-identity-review.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, test/milestone-6-mcp-oauth.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/mercado-pago-production-deployment.test.mjs, .spec/features/resolve-node-review-todos/inventory.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Red proved the explicit module graph and provider visibility before moving files. Green introduced WordPressModule, RegistrationModule, and BetterAuthModule. T-198 subsequently promoted them to sibling features, added the OAuth issuer module later clarified by T-201, and replaced the shared root contracts with feature-owned errors and OAuth policy.

## T-195 — Prove the native WordPress GraphQL registration capabilities [concluida]

- Refs: US-113, AC-237
- Arquivos: apps/wordpress-integration/scripts/probe-registration.mjs, test/wordpress-registration-graphql.contract.test.mjs, docs/evidence/wordpress-registration-graphql.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Inspect the pinned running schema and prove whether native named mutations cover customer registration, Better Auth subject metadata, and compensating deletion. Record exact operation names, authentication requirements, and any capability gap. Do not change production behavior in this task.

## T-196 — Establish the GraphQL-only WordPress identity decision [concluida]

- Refs: US-113, AC-237
- Arquivos: docs/adrs/003-wordpress-federation.md, docs/adrs/007-federated-platform-boundaries.md, docs/adrs/009-wordpress-identity-registration.md, libs/contracts/graphql/wordpress/schema.graphql, .spec/features/refactor-registration-boundaries/spec.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-195, reconcile the accepted ADRs with the user-confirmed GraphQL-only boundary. Prefer native plugin operations; authorize only the smallest private schema extension if the proof demonstrates a missing registration capability.

## T-197 — Migrate WordPress identity registration to GraphQL [concluida]

- Refs: US-113, AC-238, AC-240
- Arquivos: libs/identity/nest/src/wordpress/wordpress.config.ts, libs/identity/nest/src/wordpress/wordpress-identity.service.ts, libs/identity/nest/src/wordpress/wordpress-identity.service.spec.ts, libs/identity/nest/src/wordpress/wordpress.error.ts, libs/identity/nest/src/wordpress/wordpress.module.ts, libs/identity/nest/src/wordpress/wordpress.module.spec.ts, apps/wordpress-integration/scripts/install-plugins.sh, apps/wordpress-integration/scripts/production-entrypoint.sh, compose.yaml
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Red proves named GraphQL operations, error mapping, service authentication, and the absence of WooCommerce REST customer calls. Green implements the minimum native GraphQL client and adds a private WordPress extension only if T-195 proved it necessary.

## T-198 — Split identity authentication into sibling feature modules [concluida]

- Refs: US-113, AC-239, AC-240
- Arquivos: libs/identity/nest/src/better-auth/better-auth.module.ts, libs/identity/nest/src/better-auth/better-auth.module.integration.spec.ts, libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/better-auth/better-auth.error.ts, libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts, libs/identity/nest/src/oauth-issuer/oauth-issuer.module.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-client-provisioning.service.ts, libs/identity/nest/src/oauth-issuer/oauth-client-provisioning.service.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-clients.controller.ts, libs/identity/nest/src/oauth-issuer/oauth-resources.ts, libs/identity/nest/src/oauth-issuer/oauth.error.ts, libs/identity/nest/src/registration/registration.module.ts, libs/identity/nest/src/registration/registration.module.spec.ts, libs/identity/nest/src/registration/registration.service.ts, libs/identity/nest/src/registration/registration.service.spec.ts, libs/identity/nest/src/registration/registration-compensation.service.ts, libs/identity/nest/src/registration/registration-compensation.service.spec.ts, libs/identity/nest/src/registration/registration.error.ts, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/index.ts, apps/identity-subgraph/src/main.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-197. Red proves the sibling module graph and provider visibility. Green removes the mixed `auth` container, colocates each module with its feature, moves OAuth policy and bootstrap ownership into OAuth, and splits feature errors without adding barrels, ports, gateways, or generic layers.

## T-199 — Verify the GraphQL boundary and identity module architecture [concluida]

- Refs: US-113, AC-237, AC-238, AC-239, AC-240
- Arquivos: test/identity-federation-refactor.test.mjs, test/structural-identity-review.test.mjs, test/architecture-boundaries.test.mjs, test/marco-0-wordpress.test.mjs, docs/evidence/refactor-registration-boundaries/review.md, .spec/verification/refactor-registration-boundaries.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-198. Update architecture and contract evidence, then run focused tests, integration tests, coverage, typecheck, lint, `onp-spec verify refactor-registration-boundaries`, and `onp-spec audit --ci`. No criterion is complete without passing executable proof.

## T-201 — Clarify OAuth issuer and resource-server ownership [concluida]
- Refs: US-115, AC-244
- Arquivos: libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts, libs/identity/nest/src/oauth-issuer/oauth-issuer.module.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-client-provisioning.service.ts, libs/identity/nest/src/oauth-issuer/oauth-client-provisioning.service.spec.ts, libs/identity/nest/src/oauth-issuer/oauth-clients.controller.ts, libs/identity/nest/src/oauth-issuer/oauth-resources.ts, libs/identity/nest/src/oauth-issuer/oauth.error.ts, libs/identity/nest/src/better-auth/better-auth.factory.ts, libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/graphql/identity.resolver.ts, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/index.ts, apps/identity-subgraph/src/main.ts, test/milestone-6-mcp-oauth.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, test/structural-identity-review.test.mjs, test/milestone-8-identity-gateway.test.mjs, docs/evidence/refactor-registration-boundaries/review.md, .spec/features/refactor-registration-boundaries/design.md, .spec/features/resolve-node-review-todos/inventory.json, .spec/verification/refactor-registration-boundaries.json
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Follow Red, Green, and Refactor. Rename the Identity feature to `oauth-issuer`, rename bootstrap to client provisioning, preserve the public `/oauth/clients` response and OAuth behavior, keep Platform's `OAuthResourceModule` unchanged, and remove the redundant `app.get(...)` lookup from application startup. Do not introduce a new abstraction.
