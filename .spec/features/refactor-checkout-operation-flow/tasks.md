# Tasks: Refactor checkout operation flow

> feature: refactor-checkout-operation-flow

## Execution authorization

- The owner explicitly approved sequential execution of T-287 through T-300
  with `gpt-5.6-luna` and low effort on 2026-09-11.
- A clean Codex session launched for one task is already executing that
  approval. It must not ask for model, effort, parallelism, or execution
  confirmation again; it must start only its assigned task immediately.
- The supervising context validates the production/test diff and evidence
  before marking a task complete. A task that cannot implement its scope must
  exit non-zero and remain pending; an empty or status-only commit is invalid.

## T-287 — Add focused Red tests for checkout identity and non-blocking duplicates [concluida]
- Refs: US-152, AC-333, AC-335, AC-337
- Arquivos: apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Red-only task. Preserve every existing assertion and `@spec` tag. Add focused tests proving deterministic subject-scoped identity, subject-scoped operation keys, and prompt duplicate return without waiting. Record focused failures caused by the legacy random ID, global key scope, and synchronous wait. Compilation, infrastructure, timing, or renamed old tests do not count. Do not edit production or task/plan files.

## T-288 — Implement deterministic checkout identity and command hashing contract [concluida]
- Refs: US-152, AC-333, AC-334, US-153, AC-339, AC-342
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutOperationId.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutCommand.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutCommandHash.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutResult.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-287. Read `design.md` completely. Red: add focused value-object/hash tests before production changes. Green: add the framework-free length-prefixed name-based `CheckoutOperationId`, expose it from the command, preserve the independent semantic hash and the byte-compatible Woo reference, and make the result operation-shaped only as far as these tests require. No random checkout or Transaction identity and no new dependency. Refactor with the focused suite green.

## T-289 — Configure per-operation Axon sequencing without global serialization [concluida]
- Refs: US-152, AC-336
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutCommand.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-288. Red: prove same routing key has local max concurrency one and different keys overlap with barriers and bounded futures. Green: use only the verified Axon 5.3.1 command routing metadata plus one Spring-discovered `CommandSequencingInterceptor` with `RoutingKeySequencingPolicy.INSTANCE`. Do not add dependencies, global serialization, or claim this JVM-local interceptor is a distributed lock. Refactor with focused Axon tests green.

## T-290 — Refactor the complete checkout core as one compilable slice [concluida]
- Refs: US-152, AC-334, AC-335, AC-337, US-153, AC-339, AC-340, AC-341, AC-342, US-154, AC-343, US-156, AC-348, AC-349, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/GraphQlErrorResolver.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutIdempotencyConflictException.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutBusyException.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/WooCommerceOrderPort.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationEntity.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationJpaRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaCheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionReadRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionPersistenceMapper.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapter.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapterTest.java, docs/adrs/006-woocommerce-idempotent-checkout.md
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-289. This is one atomic core slice: removing `Claim` from the repository contract necessarily changes its current `CheckoutService` caller, and the service transition is inseparable from Woo reconciliation. Read the Flyway baseline and `design.md`. Red: use the existing focused service, adapter, Axon, and real PostgreSQL fixtures to prove the full T-290 matrix before production edits. Green: implement deterministic PK plus `UNIQUE(subject, operation_key)`; race-safe short-transaction `createOrLoad` whose unique loser reloads and validates operation ID, command hash, and Woo reference; remove Claim/owner/lease/poll/sleep/wait and `CheckoutBusyException`; persist the one-winner `PENDING_WOO -> WOO_CREATION_REQUESTED` transition and commit before create; reconcile requested state only with `findByReference`; never blindly recreate; retain deterministic Woo reference; persist Woo/order/payment/error outcomes and owned reads; return current operation immediately for duplicates; dispatch deterministic Transaction asynchronously with existing `CommandGateway.send`. Keep first Woo create synchronous as designed. Confirm `createOrFind` is non-atomic find-then-create in test and ADR. Do not add locks, compatibility shims, dependencies, GraphQL/SSE/outbox changes, or modify WordPress. Refactor with all four focused suites and compilation green.

## T-295 — Expose checkout operation through GraphQL mutation and query [concluida]
- Refs: US-152, AC-337, US-154, AC-343, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutGraphQlController.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/CheckoutOperationView.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperation.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperationHandler.java, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/test/java/dev/desafio/transaction/graphql/OrderWorkflowGraphQlCompatibilityTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-290. Bounded context: Transaction. Use case: start or observe an idempotent checkout operation. Aggregate: none; the durable checkout-operation record is the application consistency record and `Transaction` remains the existing aggregate. Invariants: operation fields are persisted and owner-scoped; only safe error reasons cross GraphQL; mutation and query expose the same durable state without polling or synthetic Order results. Consistency boundary: one owner-filtered operation projection read or command result. Affected ports: existing Reactor command/query gateways and TransactionReadRepository. Red: assert mutation and owned query return the same operation shape for processing/completed/failed states and reject cross-owner access. Green: make `startCheckout` return `CheckoutOperation` with id, operationKey, status, orderId, paymentId and safe error; reuse the existing query path and security scopes. Preserve current user edits where still valid. Do not return an artificial completed Order, poll, or change unrelated GraphQL contracts. Refactor with focused GraphQL tests green.

## T-296 — Stream checkout operation updates over existing SSE [concluida]
- Refs: US-154, AC-344, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/subscription, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql/TransactionSubscriptionController.java, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-295. Red: prove owner-scoped `PROCESSING -> COMPLETED` or failed updates, stale-version suppression, cancellation, and durable reconnect. Green: add `checkoutUpdated(operationId)` to the existing GraphQL-over-SSE controller/transport and emit only committed operation versions through the minimum application port/adapter needed. Do not add another endpoint, poll GraphQL, or alter existing Order subscriptions. Refactor with focused SSE tests green.

## T-297 — Verify deterministic Payment provider idempotency [concluida]
- Refs: US-153, AC-338, AC-339, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransaction.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransactionHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProvider.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-296 and consumes, but does not redesign, the separate provider-effect recovery contract. Red: simulate a lost local result and capture two provider requests. Green only if needed: preserve deterministic Transaction ID, `payment:<operationId>`, `operationKey:payment`, and the existing `X-Idempotency-Key`; both attempts must carry the identical key and represent one logical payment. Do not couple domain to the provider SDK or change unrelated payment recovery.

## T-298 — Commit Transaction projection and integration outbox atomically [concluida]
- Refs: US-155, AC-345
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/event/TransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionViewStore.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionalTransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-297. Red: force failure between projection and outbox and prove one rollback/commit boundary. Green: add one outer Spring `@Transactional` infrastructure event handler, make both delegated JPA stores join with REQUIRED, and register only the wrapper. Keep only the explicit version-1 `transaction.order-received.v1` integration mapping; never publish all Axon events. Refactor with focused PostgreSQL tests green.

## T-299 — Prove existing outbox relay and consumer delivery guarantees [pendente]

- Refs: US-155, AC-346, AC-347, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging/ReliableAmqpConsumer.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging/OutboxRelay.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/persistence/JpaOutboxStore.java, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-298. Red: extend the existing real PostgreSQL/RabbitMQ integration fixture for broker outage retention, later publication, two relay instances and duplicate redelivery. Green only where evidence exposes a gap: reuse current row claims, publisher confirms, retry and durable inbox. Delivery remains at-least-once; outbox coordination may use its own bounded PostgreSQL claim but checkout may not. Do not use RabbitMQ or the outbox lease as checkout exclusion.

## T-300 — Remove obsolete checkout machinery and close all gates [pendente]

- Refs: US-152, US-153, US-154, US-155, US-156, AC-333, AC-334, AC-335, AC-336, AC-337, AC-338, AC-339, AC-340, AC-341, AC-342, AC-343, AC-344, AC-345, AC-346, AC-347, AC-348, AC-349, AC-350
- Arquivos: apps/payment-federation, test/migrate-order-workflow-to-axon-java.test.mjs, .spec/features/refactor-checkout-operation-flow
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-287 through T-299 and runs last. Add the existing Java-to-TAP bridge coverage for AC-333 through AC-350 without removing historical tags or launching duplicate Gradle runs. Execute the removal and structured-log checklists from `design.md`; remove only artifacts whose guarantees are already covered. Run focused tests, the full Payment Federation test, JaCoCo coverage, build, lint/check, `onp-spec verify refactor-checkout-operation-flow`, and `onp-spec audit --ci`. Stop after three identical infrastructure failures and report them; never weaken/skip/delete a test or edit unrelated feature failures merely to make the global audit green.
