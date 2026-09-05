# Tasks: Payment Federation clean architecture

> feature: payment-federation-clean-architecture

## T-129 — Migrate Payment into the canonical bounded context [concluida]
- Refs: US-084, US-085, AC-170, AC-171, AC-172
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/PaymentFederationApplication.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/domain/Payment.java, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration, apps/payment-federation/src/main/resources/db/migration/V3__mercado_pago_payment_lifecycle.sql, apps/payment-federation/src/main/resources/db/migration/V4__provider_notification_inbox.sql
- Notas: Consolidate original and provider code into one Payment context, make provider results durable, and remove duplicate/compatibility implementations instead of wrapping them.

## T-130 — Migrate Inventory and split Spring composition roots [concluida]
- Refs: US-084, US-085, AC-170, AC-171, AC-172
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/domain, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/application, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/adapter, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/configuration, apps/payment-federation/src/main/java/dev/desafio/transaction
- Notas: Move JDBC and WooCommerce concerns out of Inventory application code, split context-specific configuration, update component scanning, and delete the complete legacy production package after migration.

## T-131 — Migrate tests and enforce architectural boundaries [concluida]
- Refs: US-084, US-085, AC-170, AC-171, AC-172
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/test/java/dev/desafio, test/architecture-boundaries.test.mjs, test/order-workflow-architecture.test.mjs, test/mercado-pago-payment-provider.spec.test.mjs, test/payment-federation-clean-architecture.spec.test.mjs, docs/adrs/007-federated-platform-boundaries.md, docs/adrs/010-mercado-pago-payment-provider.md
- Notas: Move behavioral tests to canonical packages, add executable inward-dependency and legacy-removal checks, run Java build/tests, GraphQL composition, repository tests, and ESLint.

## T-132 — Clean branch history and close both verification gates [concluida]
- Refs: US-086, AC-173, AC-169, AC-172
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: .spec/features/payment-federation-clean-architecture, .spec/features/mercado-pago-payment-provider/tasks.md, .spec/verification/payment-federation-clean-architecture.json, .spec/verification/mercado-pago-payment-provider.json, libs/identity/nest/src/better-auth/better-auth.factory.ts, graphify-out
- Notas: Preserve Better Auth work as its own boundary, remove/consolidate failed generated commits before any push, refresh Graphify, run the code-review loop, ESLint, both feature verifies, and audit --ci.
