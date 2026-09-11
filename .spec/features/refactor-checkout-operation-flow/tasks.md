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

## T-290 — Replace checkout lease columns with durable operation schema [pendente]

- Refs: US-152, AC-335, US-154, AC-343, US-156, AC-348, AC-349
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationEntity.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionPersistenceMapper.java, apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-289. Read the current repeatable Flyway baseline. Red: assert deterministic operation primary key, real `UNIQUE(subject, operation_key)`, required outcome fields and absence of checkout owner/lease columns and index. Green: migrate only that schema/entity/mapping, rename `CREATING_WOO` to `WOO_CREATION_REQUESTED` without losing its durable uncertain-effect meaning, and keep unique Woo reference/order identifiers. Do not introduce another migration tool or lock. Refactor with focused real PostgreSQL evidence green.

## T-291 — Implement race-safe create-or-load and idempotency conflict [pendente]

- Refs: US-152, AC-334, AC-335
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutIdempotencyConflictException.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationJpaRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaCheckoutOperationRepository.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-290. Red: use two repository instances and a barrier against one PostgreSQL container for the insert race; also test same pair/different hash. Green: replace Claim creation semantics with short-transaction `createOrLoad`; the unique-violation loser reloads by subject/key and validates operation ID, command hash, and Woo reference. Use the existing project exception if its name and semantics already fit. No select-if-insert guarantee, pessimistic business lock, owner, or lease. Refactor with focused persistence tests green.

## T-292 — Persist monotonic Woo attempt and operation outcomes [pendente]

- Refs: US-153, AC-340, AC-341, US-154, AC-343, US-156, AC-349
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationJpaRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaCheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionReadRepository.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-291. Red: prove the conditional `PENDING_WOO -> WOO_CREATION_REQUESTED` has one winner, commits before an independent transaction observes it, and result/error fields reload. Green: add the minimum conditional update-count transition plus record Woo, complete, optional terminal fail, and owned find operations from `design.md`; remove owner parameters from these APIs. This state is a durable side-effect fact, never a lease. Refactor with focused PostgreSQL tests green.

## T-293 — Return current checkout state and dispatch Transaction asynchronously [pendente]

- Refs: US-152, AC-334, AC-337, US-153, AC-339, US-154, AC-343, US-156, AC-348, AC-349, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutBusyException.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/TransactionCommands.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-292. Red: extend focused tests for completed retry, different-hash rejection, deterministic Transaction replay and asynchronous dispatch. Green: remove the claim/poll/sleep/wait loop, return durable operation state to duplicate requests, use existing non-blocking `CommandGateway.send`, and use `CheckoutOperationId.value()` as deterministic `StartTransaction.transactionId`. Completion handling may update only safe durable outcomes; a retry redispatches the same deterministic command after a lost callback. First Woo create remains synchronous per the approved design. Preserve the existing single `@Bean` registration of `CheckoutCommandHandler`; remove inaccurate comments and delete `CheckoutBusyException` only after its last use. Refactor with focused tests green.

## T-294 — Preserve WooCommerce uncertain-result reconciliation [pendente]

- Refs: US-153, AC-340, AC-341, AC-342, US-156, AC-349, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/WooCommerceOrderPort.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapter.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapterTest.java, docs/adrs/006-woocommerce-idempotent-checkout.md
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-293. Red: cover normal create ordering, confirmed retry, crash after remote create, timeout, requested/not-found ambiguity, deterministic reference and no second create. Green: create only after this invocation wins the already-committed monotonic transition; requested state performs one `findByReference` and never create; confirmed/completed never call Woo. Preserve `CheckoutCommandHash.wooReference` byte-for-byte. Characterize `createOrFind` honestly as non-atomic find-then-create in tests and ADR; do not change WordPress or add a lock. Refactor with focused tests green.

## T-295 — Expose checkout operation through GraphQL mutation and query [pendente]

- Refs: US-152, AC-337, US-154, AC-343, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutGraphQlController.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/CheckoutOperationView.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperation.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperationHandler.java, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/test/java/dev/desafio/transaction/graphql/OrderWorkflowGraphQlCompatibilityTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-294. Red: assert mutation and owned query return the same operation shape for processing/completed/failed states and reject cross-owner access. Green: make `startCheckout` return `CheckoutOperation` with id, operationKey, status, orderId, paymentId and safe error; reuse the existing query path and security scopes. Preserve current user edits where still valid. Do not return an artificial completed Order, poll, or change unrelated GraphQL contracts. Refactor with focused GraphQL tests green.

## T-296 — Stream checkout operation updates over existing SSE [pendente]

- Refs: US-154, AC-344, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/subscription, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql/TransactionSubscriptionController.java, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-295. Red: prove owner-scoped `PROCESSING -> COMPLETED` or failed updates, stale-version suppression, cancellation, and durable reconnect. Green: add `checkoutUpdated(operationId)` to the existing GraphQL-over-SSE controller/transport and emit only committed operation versions through the minimum application port/adapter needed. Do not add another endpoint, poll GraphQL, or alter existing Order subscriptions. Refactor with focused SSE tests green.

## T-297 — Verify deterministic Payment provider idempotency [pendente]

- Refs: US-153, AC-338, AC-339, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransaction.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransactionHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProvider.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-296 and consumes, but does not redesign, the separate provider-effect recovery contract. Red: simulate a lost local result and capture two provider requests. Green only if needed: preserve deterministic Transaction ID, `payment:<operationId>`, `operationKey:payment`, and the existing `X-Idempotency-Key`; both attempts must carry the identical key and represent one logical payment. Do not couple domain to the provider SDK or change unrelated payment recovery.

## T-298 — Commit Transaction projection and integration outbox atomically [pendente]

- Refs: US-155, AC-345
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/event/TransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionViewStore.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionalTransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-297. Red: force failure between projection and outbox and prove one rollback/commit boundary. Green: add one outer Spring `@Transactional` infrastructure event handler, make both delegated JPA stores join with REQUIRED, and register only the wrapper. Keep only the explicit version-1 `transaction.order-received.v1` integration mapping; never publish all Axon events. Refactor with focused PostgreSQL tests green.

## T-299 — Prove existing outbox relay and consumer delivery guarantees [pendente]

- Refs: US-155, AC-346, AC-347, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging/ReliableAmqpConsumer.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging/OutboxRelay.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging/JpaOutboxStore.java, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-298. Red: extend the existing real PostgreSQL/RabbitMQ integration fixture for broker outage retention, later publication, two relay instances and duplicate redelivery. Green only where evidence exposes a gap: reuse current row claims, publisher confirms, retry and durable inbox. Delivery remains at-least-once; outbox coordination may use its own bounded PostgreSQL claim but checkout may not. Do not use RabbitMQ or the outbox lease as checkout exclusion.

## T-300 — Remove obsolete checkout machinery and close all gates [pendente]

- Refs: US-152, US-153, US-154, US-155, US-156, AC-333, AC-334, AC-335, AC-336, AC-337, AC-338, AC-339, AC-340, AC-341, AC-342, AC-343, AC-344, AC-345, AC-346, AC-347, AC-348, AC-349, AC-350
- Arquivos: apps/payment-federation, test/migrate-order-workflow-to-axon-java.test.mjs, .spec/features/refactor-checkout-operation-flow
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-287 through T-299 and runs last. Add the existing Java-to-TAP bridge coverage for AC-333 through AC-350 without removing historical tags or launching duplicate Gradle runs. Execute the removal and structured-log checklists from `design.md`; remove only artifacts whose guarantees are already covered. Run focused tests, the full Payment Federation test, JaCoCo coverage, build, lint/check, `onp-spec verify refactor-checkout-operation-flow`, and `onp-spec audit --ci`. Stop after three identical infrastructure failures and report them; never weaken/skip/delete a test or edit unrelated feature failures merely to make the global audit green.
