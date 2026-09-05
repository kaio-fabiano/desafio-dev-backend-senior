# Node TODO resolution review

Status: complete. All findings are resolved and all final verification gates passed.

The review resolved 226 original marker-bearing lines across 63 files. These
counts represent review questions, not 226 distinct defects. Each original
marker remains preserved in [the inventory](../../.spec/features/resolve-node-review-todos/inventory.json)
with its disposition, maintained owner, tests, and evidence. The inventory
closure test passes, and the final Node source scan has no open review markers.
Generated reports and SST internals are outside the review scope.

## Verified corrections

- Gateway authentication distinguishes invalid credentials from provider failures.
  Federation forwarding uses explicit capabilities, a trusted origin, and a
  commerce-cookie allowlist while preserving multiple response cookies.
- Better Auth remains the only identity store. Nest owns provider cleanup;
  bootstrap is repeatable, and failed registration compensates only resources
  created by that attempt. Legacy identity consumers now use maintained code.
- Checkout validates payment inputs and decimal amounts before remote effects.
  Database-clock leases, owner tokens, and retry reconciliation prevent duplicate
  WooCommerce orders. Raw SQL now participates in its intended transaction.
- Inbox, saga, outbox, and PostgreSQL notifications commit or roll back together.
  RabbitMQ confirms, retry limits, malformed-message handling, and resource
  cleanup have regression coverage with real PostgreSQL and RabbitMQ containers.
- GraphQL SSE uses Nest middleware and the supported Express adapter. Request
  cancellation reaches the subscription iterator, and the Nest/Apollo shutdown
  order releases streams without hanging. Ownership, scopes, replay, disconnect,
  and shutdown are covered through real HTTP tests.
- All three app builds emit JavaScript. Nx caches app and library outputs and
  builds referenced libraries before typechecking. All 43 spec files are included
  in test-typecheck projects and discoverable by the IDE with decorators enabled.

Per-task implementation and Red/Green evidence are recorded in
[the evidence directory](../evidence/node-review/T-190.md), with separate reports
for T-183 through T-189.

## Approved execution

The user approved the model/effort table and parallel execution with "y".
T-183 prepared the runtime and tooling first. Gateway, identity, and workflow
then ran in isolated worktrees, with coordinated integration of shared files.
The final workflow review used two agents on distinct files with the same
approved model and effort. T-190 integrated and verified the result. The root
branch, index, and pre-existing user changes were preserved.

## Task ownership

| Task                                                                      | Marker lines | Model         | Effort |
| ------------------------------------------------------------------------- | -----------: | ------------- | ------ |
| T-183: Prepare decorator runtime, test ownership and coverage             |            1 | gpt-5.6-terra | medio  |
| T-184: Resolve gateway authentication, federation and loader findings     |           25 | gpt-5.6-sol   | alto   |
| T-185: Resolve Better Auth lifecycle, registration and resource scopes    |           35 | gpt-5.6-sol   | alto   |
| T-186: Consolidate identity application, GraphQL and legacy consumers     |           41 | gpt-5.6-terra | medio  |
| T-187: Resolve checkout, command hashing and persistence findings         |           54 | gpt-5.6-sol   | alto   |
| T-188: Resolve inbox, outbox, messaging and saga findings                 |           26 | gpt-5.6-sol   | alto   |
| T-189: Resolve workflow GraphQL, bootstrap and SSE findings               |           44 | gpt-5.6-sol   | alto   |
| T-190: Integrate corrections and close every review finding with evidence |            0 | gpt-5.6-terra | medio  |

## Original file inventory

| File                                                                                 | Marker lines | Task  |
| ------------------------------------------------------------------------------------ | -----------: | ----- |
| `apps/gateway/src/app.module.ts`                                                     |            1 | T-184 |
| `apps/gateway/src/catalog/order-loader.ts`                                           |            1 | T-184 |
| `apps/gateway/src/catalog/product-loader.ts`                                         |            1 | T-184 |
| `apps/gateway/src/catalog/request-metrics.ts`                                        |            1 | T-184 |
| `apps/gateway/src/health.controller.ts`                                              |            1 | T-184 |
| `apps/gateway/src/main.ts`                                                           |            1 | T-184 |
| `apps/identity-subgraph/src/app.module.ts`                                           |            1 | T-186 |
| `apps/identity-subgraph/src/auth/config.ts`                                          |            3 | T-186 |
| `apps/identity-subgraph/src/auth/http-bridge.ts`                                     |            1 | T-186 |
| `apps/identity-subgraph/src/auth/seed.ts`                                            |            1 | T-186 |
| `apps/identity-subgraph/src/graphql/identity-schema.ts`                              |            1 | T-186 |
| `apps/identity-subgraph/src/graphql/identity.module.ts`                              |            1 | T-186 |
| `apps/identity-subgraph/src/graphql/identity.resolver.ts`                            |            1 | T-186 |
| `apps/identity-subgraph/src/graphql/postgres-user.repository.ts`                     |            2 | T-186 |
| `apps/identity-subgraph/src/health.controller.ts`                                    |            2 | T-186 |
| `apps/identity-subgraph/src/main.ts`                                                 |            1 | T-186 |
| `apps/identity-subgraph/src/registration/better-auth-identity.adapter.ts`            |            2 | T-186 |
| `apps/identity-subgraph/src/registration/registration-handler.ts`                    |            4 | T-186 |
| `apps/identity-subgraph/src/registration/sign-up-user.ts`                            |            4 | T-186 |
| `apps/identity-subgraph/src/registration/wordpress-identity.adapter.ts`              |            1 | T-186 |
| `apps/identity-subgraph/src/registration/wordpress-identity.port.ts`                 |            1 | T-186 |
| `apps/identity-subgraph/src/supplier/owned-product-mutations.ts`                     |            5 | T-186 |
| `apps/identity-subgraph/src/supplier/product-ownership.ts`                           |            2 | T-186 |
| `apps/identity-subgraph/src/supplier/supplier-company.ts`                            |            2 | T-186 |
| `apps/order-workflow-subgraph/src/checkout/checkout.repository.ts`                   |            4 | T-187 |
| `apps/order-workflow-subgraph/src/checkout/checkout.service.ts`                      |           16 | T-187 |
| `apps/order-workflow-subgraph/src/checkout/command-hash.ts`                          |            7 | T-187 |
| `apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts`                  |           15 | T-187 |
| `apps/order-workflow-subgraph/src/checkout/woo-checkout.port.ts`                     |            2 | T-187 |
| `apps/order-workflow-subgraph/src/graphql/authenticated-subject.decorator.ts`        |            3 | T-189 |
| `apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.ts`      |           11 | T-189 |
| `apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts`          |            3 | T-189 |
| `apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts`                |           16 | T-189 |
| `apps/order-workflow-subgraph/src/graphql/order-workflow-operations.token.ts`        |            1 | T-189 |
| `apps/order-workflow-subgraph/src/health.controller.ts`                              |            2 | T-189 |
| `apps/order-workflow-subgraph/src/inbox/inbox.repository.ts`                         |            6 | T-188 |
| `apps/order-workflow-subgraph/src/main.ts`                                           |            5 | T-189 |
| `apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts`     |            6 | T-188 |
| `apps/order-workflow-subgraph/src/messaging/rabbitmq.ts`                             |            1 | T-188 |
| `apps/order-workflow-subgraph/src/outbox/outbox.publisher.ts`                        |            6 | T-188 |
| `apps/order-workflow-subgraph/src/outbox/outbox.repository.ts`                       |            5 | T-188 |
| `apps/order-workflow-subgraph/src/persistence/entities/checkout-operation.entity.ts` |            3 | T-187 |
| `apps/order-workflow-subgraph/src/persistence/entities/inbox-record.entity.ts`       |            2 | T-187 |
| `apps/order-workflow-subgraph/src/persistence/entities/order-workflow.entity.ts`     |            1 | T-187 |
| `apps/order-workflow-subgraph/src/persistence/entities/outbox-event.entity.ts`       |            2 | T-187 |
| `apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts`                   |            2 | T-187 |
| `apps/order-workflow-subgraph/src/saga/order-event.consumer.ts`                      |            1 | T-188 |
| `apps/order-workflow-subgraph/src/saga/order-saga.ts`                                |            1 | T-188 |
| `apps/order-workflow-subgraph/src/order-events/postgres/mikro-orm-order-event.replay.ts` |         1 | T-189 |
| `apps/order-workflow-subgraph/src/graphql/sse/sse-handler.ts`                        |            2 | T-189 |
| `libs/gateway/nest/src/auth/auth-context.factory.ts`                                 |           12 | T-184 |
| `libs/gateway/nest/src/auth/token-verifier.service.ts`                               |            3 | T-184 |
| `libs/gateway/nest/src/federation/authenticated-data-source.ts`                      |            3 | T-184 |
| `libs/gateway/nest/src/gateway.module.ts`                                            |            1 | T-184 |
| `libs/identity/TODO.MD`                                                              |            1 | T-183 |
| `libs/identity/nest/src/auth/better-auth.factory.ts`                                 |           10 | T-185 |
| `libs/identity/nest/src/auth/better-auth.module.ts`                                  |            5 | T-185 |
| `libs/identity/nest/src/auth/registration.service.ts`                                |           19 | T-185 |
| `libs/identity/nest/src/auth/resource-audiences.ts`                                  |            1 | T-185 |
| `libs/identity/nest/src/graphql/identity.resolver.ts`                                |            3 | T-186 |
| `libs/identity/nest/src/graphql/user.loader.ts`                                      |            1 | T-186 |
| `libs/identity/nest/src/identity.module.ts`                                          |            1 | T-186 |
| `libs/identity/nest/src/index.ts`                                                    |            1 | T-186 |

## Validation

- Node TAP contracts: 212 tests passed.
- Vitest unit/integration and coverage: 243 tests across 43 files passed.
- Build, lint, production typecheck, and test-typecheck: all six Node app/library
  projects passed uncached. Critical coverage floors remain 100% lines,
  statements, and functions, with at least 95% branches per file.
- Docker builds: gateway, identity, and workflow passed from the monorepo root.
- Inventory closure, source marker scan, and Graphify consistency: passed.
- `onp-spec verify`: all 35 features passed with actual suite exit code zero.
- `onp-spec audit --ci`: clean, zero warnings; all 182 acceptance criteria have
  tests and passing proof. T-183 through T-190 are complete.
