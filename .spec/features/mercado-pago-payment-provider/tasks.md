# Tasks: Mercado Pago payment provider

> feature: mercado-pago-payment-provider

## T-124 — Establish bounded contexts and truthful payment states [concluida]
- Refs: US-079, US-080, US-081, US-083, AC-162, AC-164, AC-166, AC-169
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/PaymentFederationApplication.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/domain/Payment.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/PaymentProvider.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/PaymentHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/PaymentRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/query/PaymentView.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/persistence/JdbcPaymentRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/application/InventoryService.java, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/application/InventoryRepository.java, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/adapter/wordpress/WooInventoryAdapter.java, apps/payment-federation/src/main/resources/db/migration/V3__mercado_pago_payment_lifecycle.sql, test/architecture-boundaries.test.mjs, test/order-workflow-architecture.test.mjs
- Notas: Move the runtime to bounded-context-first packages, delete superseded packages, and replace synthetic outcomes with provider-confirmed transitions. Do not create empty layers.

## T-125 — Integrate Mercado Pago through the outbound port [concluida]
- Refs: US-079, US-081, US-082, AC-160, AC-161, AC-162, AC-165, AC-167
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/build.gradle.kts, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProvider.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/MercadoPagoProperties.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentConfiguration.java, apps/payment-federation/src/main/resources/application.yaml
- Notas: Use the official SDK, typed configuration, bounded timeouts, operation-key idempotency, and no raw card fields.

## T-126 — Receive and deduplicate signed provider notifications [concluida]
- Refs: US-080, US-081, AC-163, AC-164, AC-165, AC-166
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookController.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/ProviderNotificationHandler.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/persistence/JdbcProviderNotificationRepository.java, apps/payment-federation/src/main/resources/db/migration/V4__provider_notification_inbox.sql
- Notas: Verify signatures before acknowledgement, fetch authoritative state, deduplicate notifications, and commit transition plus outbox atomically.

## T-127 — Propagate secure inputs and truthful outcomes [concluida]
- Refs: US-079, US-080, AC-161, AC-162, AC-164
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/contracts/events/payment-requested.v1.schema.json, libs/contracts/events/payment-authorized.v1.schema.json, libs/contracts/events/payment-pix-generated.v1.schema.json, libs/contracts/graphql/payment/schema.graphql, apps/payment-federation/src/main/resources/graphql/payment.graphqls, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/command/AuthorizePayment.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/messaging/PaymentConsumer.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/messaging/PaymentRabbitListener.java, apps/order-workflow-subgraph/src/messaging/rabbitmq.ts, apps/order-workflow-subgraph/src/saga/order-saga.ts
- Notas: Carry only provider tokens and minimum payer data; preserve Card-approved and Pix-generated challenge outcomes.

## T-128 — Prove the boundary and document operation [pendente]
- Refs: US-079, US-080, US-081, US-082, US-083, AC-160, AC-161, AC-162, AC-163, AC-164, AC-165, AC-166, AC-167, AC-168, AC-169
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookControllerTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/ProviderNotificationHandlerTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/PaymentHandlerTest.java, apps/e2e/src/journey.ts, test/mercado-pago-payment-provider.spec.test.mjs, docs/adrs/010-mercado-pago-payment-provider.md, docs/runbooks/mercado-pago-sandbox.md, docs/prds/07-roadmap.md, docs/prds/08-riscos-e-decisoes-pendentes.md
- Notas: Review correctness, security, concurrency, architecture, and unnecessary abstractions; run Java/TypeScript tests, coverage, ESLint, verify, and audit. Sandbox verification is opt-in because credentials are external secrets.
