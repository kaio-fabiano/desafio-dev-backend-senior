# Tasks: Align milestone 7 checkout contract

> feature: align-milestone-7-checkout-contract

## T-303 — Align Gateway and E2E checkout operation shapes [pendente]
- Refs: US-158, AC-352
- Arquivos: libs/contracts/graphql/order-workflow/schema.graphql, apps/e2e/src/journey.ts, apps/e2e/src/milestone-7.e2e.test.ts, test/milestone-7-e2e-contract.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Red records the current operation-shape mismatch. Green updates the static SDL and the existing acceptance client only. Refactor keeps the terminal SSE event as the synchronization boundary and performs one federated order read after completion.

## T-304 — Register production checkout query handlers deterministically [pendente]
- Refs: US-158, AC-353
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/edge/configuration/GraphQlReadConfiguration.java, apps/payment-federation/src/test/java/dev/desafio/transaction/graphql/OrderWorkflowGraphQlCompatibilityTest.java
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Java Transaction edge composition. Use case: dispatch authenticated checkout reads. Aggregate: none. Invariants: repository-backed handlers are registered whenever their required repository exists and owner isolation remains in the query. Consistency boundary: one Axon query dispatch. Affected ports: TransactionReadRepository and QueryBus. Red reproduces the production ApplicationContext missing-handler failure; Green removes only the fragile conditional registration; Refactor keeps all GraphQL authorization checks green.

## T-305 — Authenticate native WooCommerce checkout as the linked buyer [pendente]
- Refs: US-158, AC-354
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapter.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapterTest.java, apps/e2e/src/journey.ts, apps/e2e/src/milestone-7.e2e.test.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Java Transaction checkout integration. Use case: create or reconcile a buyer-owned native WooCommerce order. Aggregate: Transaction remains unchanged. Invariants: the adapter exchanges the signed subject for a short-lived WordPress token through the existing SITETOKEN provider, forwards cart session state, never stores buyer credentials, and creates exactly one order owned by the linked customer. Consistency boundary: one idempotent checkout operation and WooCommerce order. Affected ports: WooCommerceOrderPort and the existing WPGraphQL login/checkout contract. Red proves guest customer ID 0 and rejected buyer reads; Green reuses the installed provider; Refactor keeps service reconciliation and retry behavior green.
