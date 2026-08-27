# Tasks: Milestone 4 — Payment, inventory, and saga

> feature: milestone-4-payment-inventory-saga

## T-028 — Complete the versioned event contracts [concluida]
- Refs: US-026, US-027, US-028, US-029, AC-041, AC-042, AC-043, AC-044, AC-046, AC-047, AC-048, AC-049, AC-050
- Arquivos: libs/contracts/events/envelope.schema.json, libs/contracts/events/payment-requested.v1.schema.json, libs/contracts/events/payment-authorized.v1.schema.json, libs/contracts/events/payment-pix-generated.v1.schema.json, libs/contracts/events/stock-reservation-requested.v1.schema.json, libs/contracts/events/stock-reserved.v1.schema.json, libs/contracts/events/stock-reservation-failed.v1.schema.json, libs/contracts/events/payment-refund-requested.v1.schema.json, libs/contracts/events/payment-refunded.v1.schema.json, test/milestone-4-event-contracts.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Reuse the existing envelope and JSON Schema validation. Define only events exercised by Card, compensation, and Pix journeys.

## T-029 — Add RabbitMQ topology and confirmed Commerce outbox publishing [concluida]
- Refs: US-026, US-030, AC-041, AC-042, AC-051
- Arquivos: package.json, pnpm-lock.yaml, apps/commerce-subgraph/src/messaging/rabbitmq.ts, apps/commerce-subgraph/src/outbox/outbox.publisher.ts, apps/commerce-subgraph/src/outbox/outbox.repository.ts, apps/commerce-subgraph/src/persistence/entities/outbox-event.entity.ts, apps/commerce-subgraph/src/persistence/migrations/Migration202608270002.ts, test/milestone-4-outbox-publisher.test.mjs, test/milestone-4-rabbitmq-topology.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: This is distributed consistency work. Use durable native topology, mandatory publishing, confirms, manual acknowledgements, finite TTL retry queues, and an inspectable DLQ. Do not add a delayed-message plugin.

## T-030 — Scaffold the Spring Boot payment processor and Nx Gradle targets [concluida]
- Refs: US-027, AC-045
- Arquivos: package.json, pnpm-lock.yaml, nx.json, apps/payment-processor/settings.gradle.kts, apps/payment-processor/build.gradle.kts, apps/payment-processor/src/main/java/dev/desafio/payment/PaymentProcessorApplication.java, apps/payment-processor/src/main/resources/application.yaml, apps/payment-processor/src/test/java/dev/desafio/payment/PaymentProcessorApplicationTest.java, test/milestone-4-nx-gradle.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Pin compatible Spring Boot and Gradle versions, register `@nx/gradle`, and expose build/test/health through Nx. Keep the initial project minimal.

## T-031 — Implement idempotent Card, Pix, and refund processing [concluida]
- Refs: US-027, US-029, US-030, AC-043, AC-044, AC-049, AC-051
- Arquivos: apps/payment-processor/src/main/java/dev/desafio/payment/domain/Payment.java, apps/payment-processor/src/main/java/dev/desafio/payment/application/PaymentHandler.java, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentConsumer.java, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/persistence/PaymentRepository.java, apps/payment-processor/src/main/resources/db/migration/V1__payment_inbox_outbox.sql, apps/payment-processor/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java, apps/payment-processor/src/test/java/dev/desafio/payment/adapter/messaging/PaymentRedeliveryTest.java
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Payment and concurrency are critical. Record payment effect, inbox, and outgoing result atomically. Use operation/payment keys for effect idempotency and eventId for delivery deduplication.

## T-032 — Implement the idempotent WooCommerce inventory worker [concluida]
- Refs: US-028, US-030, AC-046, AC-047, AC-051
- Arquivos: apps/stock-worker/project.json, apps/stock-worker/src/inventory/inventory.service.ts, apps/stock-worker/src/inventory/woo-inventory.adapter.ts, apps/stock-worker/src/inventory/inbox.repository.ts, apps/stock-worker/src/main.ts, test/milestone-4-inventory-worker.test.mjs, test/milestone-4-inventory-redelivery.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Reuse the existing TypeScript, Nx, WooCommerce, and PostgreSQL patterns. Reserve the full order atomically from the worker perspective; release partial remote changes before publishing failure.

## T-033 — Implement monotonic Commerce saga transitions [concluida]
- Refs: US-029, US-030, AC-048, AC-049, AC-050, AC-051
- Arquivos: apps/commerce-subgraph/src/saga/order-saga.ts, apps/commerce-subgraph/src/saga/order-event.consumer.ts, apps/commerce-subgraph/src/inbox/inbox.repository.ts, apps/commerce-subgraph/src/persistence/entities/order-workflow.entity.ts, apps/commerce-subgraph/src/persistence/entities/inbox-record.entity.ts, apps/commerce-subgraph/src/persistence/migrations/Migration202608270002.ts, libs/contracts/graphql/commerce/schema.graphql, test/milestone-4-order-saga.test.mjs, test/milestone-4-order-saga-redelivery.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: This is saga consistency work. Encode an explicit transition table, reject regression, and write transition, inbox, and next outbox event in one transaction.

## T-034 — Wire services, databases, and graceful lifecycle in Compose [concluida]
- Refs: US-026, US-027, US-028, AC-042, AC-045
- Arquivos: compose.yaml, apps/commerce-subgraph/src/app.module.ts, apps/payment-processor/Dockerfile, apps/stock-worker/Dockerfile, apps/stock-worker/src/app.module.ts, test/milestone-4-compose.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Add RabbitMQ and the dedicated payment database, readiness checks, dependency health conditions, and graceful consumer shutdown. Avoid host ports unless explicitly needed.

## T-035 — Assemble the Milestone 4 acceptance and operational gate [pendente]
- Refs: US-026, US-027, US-028, US-029, US-030, AC-041, AC-042, AC-043, AC-044, AC-045, AC-046, AC-047, AC-048, AC-049, AC-050, AC-051, AC-052
- Arquivos: apps/poc-harness/project.json, test/milestone-4-payment-inventory-saga.test.mjs, docs/runbooks/milestone-4-payment-inventory-saga.md, onpspec.config.json, .github/workflows/ci.yml
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Prove Card success, stock-failure refund, Pix generation, duplicate delivery, crash after commit before ack, bounded retry, and DLQ through one Nx target. Use real infrastructure where behavior depends on broker or database guarantees.
