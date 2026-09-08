# Idiomatic NestJS module audit

> Task: T-229
>
> Snapshot: 2026-09-08
>
> Result: 17 project-authored modules reviewed; no boundary violation found.

## Scope and decision record

- Bounded context: repository architecture governance (technical boundary).
- Use case: inventory and verify every project-authored NestJS module,
  runtime composition site, and task-session boundary.
- Aggregate: none; this audit observes one repository snapshot.
- Invariants: every `@Module()` is inventoried; providers and tokens are
  explicit and unique within their module; exports are deliberate; service
  location, manual singletons, and `forwardRef()` are absent; remaining manual
  use-case construction is limited to runtime data owned by third-party hooks;
  every task starts a fresh headless Codex process and commits before dependent
  sequential work starts.
- Consistency boundary: one integrated repository and generated-plan snapshot.
- Affected ports: none.
- Exclusions: none for this audit. In particular,
  `apps/order-workflow-subgraph` is included even though it is excluded from the
  strict DDD migration inventory. `apps/payment-federation` has no NestJS
  module and therefore contributes no module row.

## Module inventory

Provider entries below name either the class provider or the explicit token in
an object provider. Empty exports are intentional. The executable test parses
the TypeScript module metadata and requires this inventory to remain exact.

| Module file                                                                 | Ownership                               | Imports                                                                                                             | Providers/tokens                                                                                                  | Exports                                                                  | Result |
| --------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ |
| `apps/gateway/src/app.module.ts`                                            | Gateway application composition         | `ConfigModule.forRoot`, `GatewayModule`                                                                             | `GatewaySseMiddleware`                                                                                            | None                                                                     | Pass   |
| `apps/identity-subgraph/src/app.module.ts`                                  | Identity application composition        | `ConfigModule.forRoot`, `IdentityModule`                                                                            | None                                                                                                              | None                                                                     | Pass   |
| `apps/order-workflow-subgraph/src/app.module.ts`                            | Order Workflow application composition  | `ConfigModule.forRoot`, `PersistenceModule`, `OrderEventsModule`, `MessagingModule`, `OrderWorkflowGraphqlModule`   | None                                                                                                              | None                                                                     | Pass   |
| `apps/order-workflow-subgraph/src/checkout/checkout.module.ts`              | Order Workflow checkout                 | `PersistenceModule`                                                                                                 | `WOO_CHECKOUT`, `CHECKOUT_REPOSITORY`, `OUTBOX_REPOSITORY`, `CheckoutService`                                     | `CheckoutService`                                                        | Pass   |
| `apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts` | Order Workflow GraphQL presentation     | `PersistenceModule`, `CheckoutModule`, `OrderEventsModule`, `OAuthResourceModule.register`, `GraphQLModule.forRoot` | `OrderWorkflowOperationsService`, `ORDER_WORKFLOW_OPERATIONS`, resolvers, SSE collaborators, `APP_GUARD`          | None                                                                     | Pass   |
| `apps/order-workflow-subgraph/src/messaging/messaging.module.ts`            | Order Workflow messaging infrastructure | `PersistenceModule`                                                                                                 | `OrderWorkflowRuntimeLifecycle`                                                                                   | `OrderWorkflowRuntimeLifecycle`                                          | Pass   |
| `apps/order-workflow-subgraph/src/order-events/order-events.module.ts`      | Order Workflow event delivery           | `PersistenceModule`                                                                                                 | `OrderEventBroker`, `MikroOrmOrderEventReplay`, `PostgresOrderEventRelay`, `OrderEventsSubscription`              | `OrderEventBroker`, `OrderEventsSubscription`, `PostgresOrderEventRelay` | Pass   |
| `apps/order-workflow-subgraph/src/persistence/persistence.module.ts`        | Order Workflow persistence              | None                                                                                                                | `ORDER_WORKFLOW_ORM`, `ORDER_WORKFLOW_ENTITY_MANAGER`                                                             | `ORDER_WORKFLOW_ORM`, `ORDER_WORKFLOW_ENTITY_MANAGER`                    | Pass   |
| `libs/gateway/nest/src/auth/gateway-auth.module.ts`                         | Gateway authentication                  | `ConfigModule`, `OAuthResourceModule.register`                                                                      | `TokenVerifierService`, `AuthContextFactory`                                                                      | `TokenVerifierService`, `AuthContextFactory`                             | Pass   |
| `libs/gateway/nest/src/gateway.module.ts`                                   | Gateway library composition             | `GatewayAuthModule`, `GraphQLModule.forRootAsync`                                                                   | None                                                                                                              | `GatewayAuthModule`                                                      | Pass   |
| `libs/identity/nest/src/better-auth/better-auth.module.ts`                  | Identity Better Auth integration        | `IdentityAuthProvidersModule`, `RegistrationModule`, `NestJSBetterAuth.forRootAsync`                                | None                                                                                                              | `NestJSBetterAuth`                                                       | Pass   |
| `libs/identity/nest/src/better-auth/identity-auth-providers.module.ts`      | Identity authentication infrastructure  | None                                                                                                                | `IdentityDatabasePool`, `BetterAuthFactory`, `IdentityAuthProvider.value`                                         | `IdentityAuthToken.value`                                                | Pass   |
| `libs/identity/nest/src/identity.module.ts`                                 | Identity library composition            | `BetterAuthModule`, `OAuthIssuerModule`, `OAuthResourceModule.register`, `GraphQLModule.forRoot`                    | user-query adapter/port, query use cases, resolver, loader, `APP_GUARD`                                           | None                                                                     | Pass   |
| `libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts`                | Identity OAuth issuance                 | `BetterAuthModule`                                                                                                  | provisioning adapters/ports, `ProvisionOAuthClientsUseCase`, `OAuthClientProvisioningService`                     | None                                                                     | Pass   |
| `libs/identity/nest/src/registration/registration.module.ts`                | Identity registration                   | `WordPressModule`                                                                                                   | `CustomerIdentityPort`, registration use cases, `RegistrationService`                                             | `RegistrationService`                                                    | Pass   |
| `libs/identity/nest/src/wordpress/wordpress.module.ts`                      | Identity WordPress infrastructure       | `ConfigModule`                                                                                                      | configuration, `WordPressIdentityService`, `WordPressCustomerIdentityAdapter`                                     | `WordPressIdentityService`, `WordPressCustomerIdentityAdapter`           | Pass   |
| `libs/platform/nest/src/oauth-resource/oauth-resource.module.ts`            | Platform authorization dynamic module   | None                                                                                                                | options token, verifier port, `VerifyOAuthCredentialUseCase`, `OAuthResourceService`, `GraphqlOAuthResourceGuard` | `OAuthResourceService`, `GraphqlOAuthResourceGuard`                      | Pass   |

The exports are explicit rather than blanket exports. Application roots export
nothing. Exporting modules expose only their cross-module runtime surface:
checkout execution, health/readiness collaborators, event subscription/relay,
persistence tokens, Gateway authentication, Better Auth, registration,
WordPress integration, and OAuth resource verification.

`APP_GUARD` occurs in two separate application ownership boundaries. Within a
single module every provider token is unique; the repeated framework token is
therefore not a duplicate provider in one ownership boundary.

## Runtime-data construction boundaries

The repository-wide production scan found exactly four manual `*UseCase`
constructions. None is a hidden stable composition root:

| Site                                                                                             | Runtime boundary                                                                                 | Why NestJS does not safely own the instance                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `libs/gateway/nest/src/federation/authenticated-data-source.ts:CaptureFederationResponseUseCase` | Apollo creates one remote data source per discovered subgraph.                                   | The use case is bound to the Apollo-owned data-source lifecycle and its per-subgraph capabilities.                                |
| `libs/gateway/nest/src/federation/authenticated-data-source.ts:PrepareFederationRequestUseCase`  | Apollo supplies the remote URL and capabilities to `buildService`.                               | Construction remains next to the Apollo-owned object so per-subgraph request/session behavior cannot leak into a shared provider. |
| `libs/gateway/nest/src/auth/auth-context.factory.ts:CreateGatewayContextUseCase`                 | The verifier compatibility adapter closes over the current request.                              | A stable provider would capture request data or require service location; explicit per-request input preserves the boundary.      |
| `apps/gateway/src/subscriptions/sse-handler.ts:ForwardGatewaySubscriptionUseCase`                | `graphql-sse` owns the handler callbacks and the handler receives a runtime subscription client. | The use case belongs to that handler instance and its runtime client rather than the application container singleton graph.       |

The same scan rejects `ModuleRef`, `forwardRef()`, static singleton instances,
and `getInstance()` in production TypeScript. No occurrence was found.

## Fresh-session and atomic-commit evidence

The generated executor has one shared `rodar_tarefa` path. Each listed task
invokes that path once, and that path starts bare `codex exec`; it never uses
`codex exec resume` or a previous transcript. The prompt repeats the one-task
scope and requires a task-owned commit.

Parallel tasks T-226 and T-228 run in separate worktrees. The executor waits
for both worktree processes and merges their commits before sequential T-229
starts on the integrated branch. This transfers state through committed files,
not conversational history. Targeted retries call the same fresh-session path.

## TDD evidence

Red was captured with:

```text
NODE_ENV=test TSX_TSCONFIG_PATH=$PWD/tsconfig.base.json node --import tsx \
  --test --test-reporter=tap test/idiomatic-nestjs-architecture.test.mjs
```

The AC-275 test failed with `ENOENT` for this required audit report while the
AC-276 executor-isolation test passed. Green adds this repository evidence;
the tests retain exact module, provider-token, manual-construction, and executor
dispatch assertions so future drift fails closed.

## Verification status

- Focused AC-275 and AC-276 tests: pass (2/2).
- Complete Vitest run: pass (64/64 files).
- Graphify refresh: 5,351 nodes, 9,653 edges, and 409 communities; the
  multigraph diagnostic found no invalid, dangling, duplicate, collapsed, or
  self-loop edges.
- Complete root Node test run: 251/252 pass. The remaining legacy AC-091 test
  in `test/architecture-boundaries.test.mjs` still rejects every
  `@nestjs/common` Application import, including the `Inject` and `Injectable`
  primitives approved by AC-270. That file is outside T-229's allowed scope;
  this audit does not weaken or alter it.
