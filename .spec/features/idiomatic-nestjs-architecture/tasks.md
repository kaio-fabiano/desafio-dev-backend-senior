# Tasks: Idiomatic NestJS architecture

> feature: idiomatic-nestjs-architecture

## Mandatory execution isolation

Every task MUST run through its own headless `codex exec` invocation. A task
MUST NOT reuse another task's conversational session or transcript. Its clean
session may read only the repository instructions, this feature's specification
and design, its own task definition, and the filesystem state available in its
dedicated worktree or in the integrated branch for prerequisites. This rule
applies equally to parallel bands, sequential tasks, and targeted retries.

Approval record: on 2026-09-08 the user explicitly answered `y`, confirming
`gpt-5.6-sol` with high effort for every task and approving T-225 through T-228
for isolated parallel execution followed by sequential T-229. This approval is
final for this generated plan and MUST NOT be requested again inside a task
session.

## T-225 — Align the executable DDD contract with NestJS injection [concluida]
- Refs: US-127, AC-270, AC-271
- Arquivos: docs/standards/strict-nestjs-ddd.md, tools/architecture/strict-ddd-policy.mjs, tools/architecture/strict-ddd-scanner.mjs, test/strict-ddd-architecture.test.mjs, test/fixtures/strict-ddd
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Follow Red, Green, Refactor. Bounded context: repository architecture governance (technical boundary). Use case: classify allowed NestJS DI in Application without permitting outer concerns. Aggregate: none. Invariants: Domain imports no NestJS; Application may use only the approved `@nestjs/common` DI primitives and remains free of transport, persistence, configuration, vendor SDKs, and concrete adapters; abstract-class ports remain canonical. Consistency boundary: one scanner evaluation of one repository snapshot. Affected ports: none. Record the focused failing architecture tests before changing the scanner or standard.

## T-226 — Make Identity use cases NestJS-managed providers [concluida]
- Refs: US-128, AC-272
- Arquivos: libs/identity/nest/src/application/use-cases, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/oauth-issuer, libs/identity/nest/src/registration, libs/identity/nest/src/identity-core.architecture.spec.ts, test/identity-federation-refactor.test.mjs, test/wordpress-registration-graphql.contract.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Depends on T-225's approved rule, but is file-disjoint and may be developed in parallel. Follow Red, Green, Refactor. Bounded context: Identity. Use cases: register identity, compensate registration, provision OAuth clients, find/list identities. Aggregate: the Identity registration consistency boundary coordinates Better Auth identity and WordPress customer linkage; query and provisioning flows have no aggregate. Invariants: stable collaborators are injected; hook-derived identity adapters remain explicit runtime input; compensation order and public errors remain unchanged; no transport/vendor type enters Application. Consistency boundary: one registration attempt, one bootstrap provisioning run, or one identity query. Affected ports: CustomerIdentityPort, IdentityAccountPort, OAuthClientProvisioningPort, OAuthSeedCredentialsPort, IdentityUserQueryPort. Do not edit `libs/identity/nest/src/identity-core.spec.ts`; preserve owner work.

## T-227 — Make OAuth verification a NestJS-managed use case [concluida]
- Refs: US-128, AC-273
- Arquivos: libs/platform/nest/src/oauth-resource/application/use-cases/verify-oauth-credential.use-case.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts, libs/platform/nest/src/oauth-resource/application/use-cases/verify-oauth-credential.use-case.spec.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts, test/oauth-resource-server-auth.spec.test.mjs, test/harden-oauth-resource-service.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Depends on T-225's approved rule, but is file-disjoint and may be developed in parallel. Follow Red, Green, Refactor. Bounded context: Platform authorization. Use case: verify an OAuth credential. Aggregate: none; verification is a stateless security policy. Invariants: URL configuration is validated, ES256 and required claims remain enforced, subject/scope validation remains unchanged, and the verifier port does not resolve to a self-referential provider cycle. Consistency boundary: one credential verification. Affected port: OAuthCredentialVerifierPort. Prefer explicit tokens/providers over `ModuleRef` or a service locator.

## T-228 — Make Gateway flows NestJS-managed providers [concluida]
- Refs: US-128, AC-274
- Arquivos: libs/gateway/nest/src/application/use-cases, libs/gateway/nest/src/auth, libs/gateway/nest/src/federation, libs/gateway/nest/src/gateway.module.ts, apps/gateway/src/app.module.ts, apps/gateway/src/subscriptions, test/gateway-federation-refactor.test.mjs, test/architecture-boundaries.test.mjs, test/clarify-gateway-module-boundaries.spec.test.mjs, test/milestone-6-apollo-mcp.test.mjs, test/milestone-6-mcp-oauth.test.mjs, test/milestone-6-mcp-propagation.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, test/remove-wordpress-federation-runtime.spec.test.mjs, test/resolve-gateway-sse-todos.test.mjs, test/structural-gateway-review.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Depends on T-225's approved rule, but is file-disjoint from Identity and Platform. Follow Red, Green, Refactor. Bounded context: Gateway edge. Use cases: create authenticated context, prepare/capture federation session state, and forward subscriptions. Aggregate: none; Gateway owns no business persistence. Invariants: authentication precedes forwarding, response headers preserve multi-cookie semantics, federation capabilities remain per-subgraph, SSE cancellation remains best-effort and leak-free, and stable collaborators come from DI. Consistency boundary: one HTTP/GraphQL/SSE request. Affected ports: GatewayTokenVerifierPort, CommerceCookiePort, OrderWorkflowSubscriptionPort. Keep Apollo and Node request types outside Application. The listed repository tests are legacy executable expectations directly coupled to the approved Gateway composition and AC-091 rule; update only assertions invalidated by the provider migration. Graphify artifacts remain owned by T-229.

## T-229 — Audit every NestJS module and close repository evidence [concluida]
- Refs: US-129, US-130, AC-275, AC-276
- Arquivos: test/idiomatic-nestjs-architecture.test.mjs, docs/architecture/idiomatic-nestjs-module-audit.md, graphify-out
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Depends on T-225 through T-228 and must run after their branches are integrated. Follow Red, Green, Refactor for the new architecture test. Bounded context: repository architecture governance (technical boundary). Use case: inventory and verify every project-authored NestJS module, runtime composition site, and task-session boundary. Aggregate: none. Invariants: every `@Module()` is inventoried, no undocumented stable use-case construction remains in production runtime code, no `ModuleRef` service locator or manual singleton is introduced, `forwardRef()` is absent unless explicitly justified, tokens are unique in their ownership boundary, exports are limited to consumers, and every task is dispatched through a dedicated fresh `codex exec` invocation. Consistency boundary: one repository and generated-plan snapshot. Affected ports: none. Include the two strict-DDD-excluded applications in this narrower NestJS audit, refresh Graphify only after code integration, and record evidence without changing public behavior.
