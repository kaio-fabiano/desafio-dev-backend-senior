# Tasks: Refactor checkout operation flow

> feature: refactor-checkout-operation-flow

## Execution authorization

- The owner explicitly approved sequential execution of T-287 through T-295
  with `gpt-5.6-luna` and low effort on 2026-09-11.
- A clean Codex session launched for one task is already executing that
  approval. It must not ask for model, effort, parallelism, or execution
  confirmation again; it must start only its assigned task immediately.
- The supervising context validates the production/test diff and evidence
  before marking a task complete. A task that cannot implement its scope must
  exit non-zero and remain pending; an empty or status-only commit is invalid.

## T-287 — Add the complete failing checkout acceptance matrix [pendente]

- Refs: US-152, US-153, US-154, US-155, US-156, AC-333, AC-334, AC-335, AC-336, AC-337, AC-338, AC-339, AC-340, AC-341, AC-342, AC-343, AC-344, AC-345, AC-346, AC-347, AC-348, AC-349, AC-350
- Arquivos: apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapterTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java, test/migrate-order-workflow-to-axon-java.test.mjs, .spec/features/refactor-checkout-operation-flow
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Red-only task. Read `design.md` completely and add the exact behavioral matrix listed there to the existing fixtures. Preserve every existing `@spec` tag and assertion; never relabel an old test as proof for a new criterion. Add focused test methods whose assertions directly prove the referenced behavior. Every AC-333 through AC-350 must appear on genuine executable evidence and in the existing Java-to-TAP bridge. Use two real repository instances for distributed PostgreSQL races, barriers/latches for concurrency, and the existing PostgreSQL/RabbitMQ containers. Run focused tests and record at least one expected behavioral failure caused by the legacy checkout; compilation, Docker setup, timing, unrelated baseline failure, or a passing assertion renamed with a new tag do not count as Red. Do not edit production, delete tests, create a second test runner, or touch unrelated dirty files.

## T-288 — Introduce deterministic checkout identity and Axon routing [pendente]

- Refs: US-152, AC-333, AC-334, AC-336, US-153, AC-339, AC-342
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutOperationId.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutCommand.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutCommandHash.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutResult.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-287 Red. Follow the exact target types in `design.md`: length-prefixed name-based deterministic ID; independent unchanged semantic hash; Axon 5.3.1 command routing key `operationId`; one Spring-discovered `CommandSequencingInterceptor` using `RoutingKeySequencingPolicy.INSTANCE`. Do not copy Axon APIs from memory, add dependencies, or claim the interceptor is distributed. Use operation ID as deterministic Transaction identity. Run focused tests Red, Green, Refactor.

## T-289 — Replace checkout claims with durable PostgreSQL operation transitions [pendente]

- Refs: US-152, AC-334, AC-335, AC-337, US-153, AC-340, AC-341, US-154, AC-343, US-156, AC-348, AC-349
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationEntity.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/CheckoutOperationJpaRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaCheckoutOperationRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionPersistenceMapper.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionReadRepository.java, apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-288. Implement exactly the repository and SQL algorithm in `design.md`: deterministic primary key; real `UNIQUE(subject, operation_key)`; insert collision reload plus hash validation; conditional `PENDING_WOO -> WOO_CREATION_REQUESTED` update count; operation result fields; no owner/lease columns, index, API, or pessimistic checkout ownership. Keep short transactions and current Flyway mechanism. The independent-transaction test must prove requested state committed before any external call. Run focused PostgreSQL tests Red, Green, Refactor.

## T-290 — Make checkout return state and dispatch Transaction asynchronously [pendente]

- Refs: US-152, AC-334, AC-336, AC-337, US-153, AC-339, AC-340, AC-341, US-154, AC-343, US-156, AC-348, AC-349, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutBusyException.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-289. Implement only the request flow in `design.md`. First Woo create remains synchronous by owner approval; duplicate operations never wait. Change Transaction dispatch to the existing non-blocking Axon `CommandGateway.send`, mark completion from its future, and safely redispatch the deterministic command after a lost callback. Preserve the user's `checkoutService` field naming and remove the inaccurate aggregate comment; avoid duplicate Spring registration. Delete `CheckoutBusyException` only after all uses are gone. No polling, sleep, lease, fire-and-forget side effect without retry identity, or new executor. Run focused tests Red, Green, Refactor.

## T-291 — Preserve WooCommerce uncertain-result reconciliation [pendente]

- Refs: US-153, AC-340, AC-341, AC-342, US-156, AC-349, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/WooCommerceOrderPort.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapter.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapterTest.java, docs/adrs/006-woocommerce-idempotent-checkout.md
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-290. Enforce the fixed Woo state table. Create is legal only after this invocation wins the committed conditional transition. Requested state uses one `findByReference` and never create; missing stays requested and exposes the existing ambiguous behavior. Confirmed/completed never call Woo. Preserve `CheckoutCommandHash.wooReference` byte-for-byte. Characterize `createOrFind` as find-then-create and update ADR 006; do not change WordPress or add a lock. Run focused tests Red, Green, Refactor.

## T-292 — Return and stream CheckoutOperation through existing GraphQL SSE [pendente]
- Refs: US-152, AC-337, US-154, AC-343, AC-344, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutGraphQlController.java, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/interfaces/graphql/CheckoutCommandHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/CheckoutOperationView.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperation.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/query/FindCheckoutOperationHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/subscription, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql/TransactionSubscriptionController.java, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/test/java/dev/desafio/transaction/graphql/OrderWorkflowGraphQlCompatibilityTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-291. Apply the exact GraphQL/SSE design: mutation and query share the operation shape; add `checkoutUpdated` to the existing subscription transport and controller; owner isolation and scopes remain; emit only committed versions; reconnect reads durable state. Preserve and clean up the user's current uncommitted comments/naming rather than overwriting them. Do not create another SSE endpoint, poll GraphQL, or change unrelated Order subscriptions. Run GraphQL and SSE tests Red, Green, Refactor.

## T-293 — Verify deterministic Payment and Transaction external identities [pendente]

- Refs: US-153, AC-338, AC-339, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransaction.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/StartTransactionHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProvider.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/application/TransactionAxonTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-292 and consumes, but does not modify, the separate provider-effect recovery contract. Keep deterministic Transaction ID, `payment:<operationId>`, and `operationKey:payment`. Prove two provider attempts after a simulated lost local result send the identical existing `X-Idempotency-Key` and represent one logical payment. Change production only if the test exposes a missing propagation; do not redesign Payment, its ledger, or provider SDK adapter.

## T-294 — Make Transaction state and RabbitMQ outbox one transaction [pendente]

- Refs: US-155, AC-345, AC-346, AC-347, US-156, AC-350
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/event/TransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionViewStore.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionOutbox.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/TransactionalTransactionEventHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/persistence/JpaTransactionPersistenceTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on T-293. Implement exactly the transactional handler design: one outer Spring transaction, delegated JPA stores join with REQUIRED, one registered Axon handler, selective version-1 integration event only. Reuse `JpaOutboxStore`, `OutboxRelay`, publisher confirms, delivery row claims, retry, and durable inbox; checkout must not use their delivery lease. Prove rollback atomicity, broker outage pending retention, later publication, multiple relays, and redelivery idempotency. Do not promise exactly once or publish all domain events. Run PostgreSQL/RabbitMQ tests Red, Green, Refactor.

## T-295 — Remove legacy checkout concurrency and close every gate [pendente]

- Refs: US-152, US-153, US-154, US-155, US-156, AC-333, AC-334, AC-335, AC-336, AC-337, AC-338, AC-339, AC-340, AC-341, AC-342, AC-343, AC-344, AC-345, AC-346, AC-347, AC-348, AC-349, AC-350
- Arquivos: apps/payment-federation, test/migrate-order-workflow-to-axon-java.test.mjs, .spec/features/refactor-checkout-operation-flow
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Depends on all previous tasks and runs last. Execute the removal checklist and structured-log audit from `design.md`; remove only artifacts whose guarantees are already proven. The existing Java-to-TAP `javaBaseline` must carry all AC tags without launching duplicate Gradle runs. Run focused tests, full Payment Federation test, JaCoCo coverage, compile/build, lint/check, `onp-spec verify refactor-checkout-operation-flow`, and `onp-spec audit --ci`. Stop after three identical infrastructure failures and report them; never weaken, skip, or delete a test and never edit unrelated feature failures merely to make the global audit green.
