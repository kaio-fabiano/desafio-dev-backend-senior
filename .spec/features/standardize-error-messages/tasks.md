# Tasks: Standardize error messages

> feature: standardize-error-messages

## T-260 — Add final executable error-message governance [pendente]

- Refs: US-139, AC-298, AC-299, AC-300, AC-301, AC-302
- Arquivos: tools/error-messages/error-message-policy.mjs, test/error-message-policy.test.mjs, docs/standards/error-message-catalogs.md
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Run after the parallel implementation lanes. Bounded context: repository architecture governance technical boundary. Use case: identify inline and missing exception messages. Aggregate: none. Invariants: deterministic local scan, exact file and line evidence, no generated or test-only inputs. Consistency boundary: one repository snapshot. Affected ports: none. Add focused policy fixtures and document the context-local catalog rule.

## T-261 — Standardize Gateway TypeScript errors [pendente]

- Refs: US-139, AC-298, AC-300, AC-301, AC-302
- Arquivos: test/error-message-gateway.test.mjs, apps/gateway/src, libs/gateway/nest/src
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Edge. Use case: construct authentication, subscription, availability, configuration, and HTTP adapter errors from context-owned catalogs. Aggregate: none. Invariants: dependency direction remains inward and existing error types/codes/text remain stable. Consistency boundary: one thrown failure. Affected ports: gateway request and token header adapters. Record focused Red evidence before source changes.

## T-262 — Standardize Java Transaction errors [pendente]

- Refs: US-139, AC-299, AC-300, AC-301, AC-302
- Arquivos: test/error-message-java-transaction.test.mjs, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Transaction. Use cases: checkout orchestration, transaction commands, queries, persistence, messaging, and WooCommerce access. Aggregate: Transaction. Invariants: transaction identity, event order, idempotency, ownership, and checkout concurrency messages retain their behavior. Consistency boundary: one transaction or checkout operation. Affected ports: checkout repository, WooCommerce order, messaging, and query ports. Follow Red, Green, Refactor.

## T-263 — Standardize Java Inventory errors [pendente]

- Refs: US-139, AC-299, AC-300, AC-301, AC-302
- Arquivos: test/error-message-java-inventory.test.mjs, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Inventory. Use cases: reserve and complete stock claims. Aggregate: Inventory reservation. Invariants: claim ownership, stock sufficiency, idempotency, and event metadata remain unchanged. Consistency boundary: one inventory reservation and its claim. Affected ports: inventory repository, WordPress inventory, Axon, and RabbitMQ adapters. Follow Red, Green, Refactor.

## T-264 — Standardize Java Payment errors [pendente]

- Refs: US-139, AC-299, AC-300, AC-301, AC-302
- Arquivos: test/error-message-java-payment.test.mjs, apps/payment-federation/src/main/java/dev/desafio/transaction/payment
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Payment. Use cases: request, authorize, refund, project, persist, and receive provider notifications. Aggregate: Payment. Invariants: provider idempotency, effect claims, notification authenticity, payment identity, and retry semantics remain unchanged. Consistency boundary: one payment and its provider effect. Affected ports: payment repositories, Mercado Pago, WordPress, Axon, and RabbitMQ adapters. Follow Red, Green, Refactor.

## T-265 — Standardize Java shared-boundary errors [pendente]

- Refs: US-139, AC-299, AC-300, AC-301, AC-302
- Arquivos: test/error-message-java-shared.test.mjs, apps/payment-federation/src/main/java/dev/desafio/transaction/contracts, apps/payment-federation/src/main/java/dev/desafio/transaction/shared, apps/payment-federation/src/main/java/dev/desafio/transaction/migration
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: integration contracts and repository technical boundaries. Use cases: validate envelopes, route messages, persist inbox/outbox state, translate GraphQL failures, and enforce migration gates. Aggregate: none; each adapter preserves its owning context consistency boundary. Invariants: wire contracts, routing, serialization, delivery guarantees, and public error text remain unchanged. Consistency boundary: one integration envelope or migration audit. Affected ports: AMQP, inbox/outbox persistence, GraphQL, and migration audit boundaries. Follow Red, Green, Refactor.

## T-266 — Standardize Identity TypeScript errors [pendente]

- Refs: US-139, AC-298, AC-300, AC-301
- Arquivos: test/error-message-identity.test.mjs, apps/identity-subgraph/src, libs/identity/nest/src
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Identity. Use cases: register identities, provision OAuth clients, configure Better Auth, and access WordPress identities. Aggregate: Identity account where registration invariants apply; none for outer configuration failures. Invariants: compensation, OAuth codes, WordPress codes, and observable text remain stable. Consistency boundary: one identity registration or provisioning operation. Affected ports: identity account, OAuth client provisioning, and WordPress ports. Follow Red, Green, Refactor.

## T-267 — Standardize Platform OAuth TypeScript errors [pendente]

- Refs: US-139, AC-298, AC-300, AC-301
- Arquivos: test/error-message-platform-oauth.test.mjs, libs/platform/nest/src
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: OAuth resource technical boundary. Use case: validate credentials, claims, request targets, guards, and GraphQL subjects. Aggregate: none. Invariants: authentication/authorization status, credential classification, scopes, and public text remain stable. Consistency boundary: one OAuth request. Affected ports: credential verification and request adapters. Follow Red, Green, Refactor.
