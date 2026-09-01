# Tasks: Production happy path hardening

> feature: production-happy-path-hardening
>
> Execution approval: the user explicitly approved `gpt-5.6-sol`, high effort,
> and parallel execution of T-103 with T-104. Executors must not request this
> confirmation again.

## T-102 — Make cart ownership and session propagation federated [concluida]
- Refs: US-063, AC-131, AC-132, US-067, AC-136
- Arquivos: libs/contracts/graphql, libs/gateway/nest/src/federation, apps/order-workflow-subgraph/src/graphql, apps/apollo-mcp/operations, apps/e2e/src, test
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Route cart mutations to WordPress, forward session headers to Commerce, inject GraphQL request context, remove the subject-to-token map, then run focused tests, affected ESLint, and code review.

## T-103 — Make WooCommerce order creation recoverable [concluida]

- Refs: US-064, AC-133, US-067, AC-136
- Arquivos: apps/order-workflow-subgraph/src/checkout, apps/order-workflow-subgraph/src/persistence, apps/order-workflow-subgraph/src/graphql, test
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Use a durable operation owner/lease and stable external reference with reconciliation after ambiguous results; never proceed after a blind timeout. Run focused tests, affected ESLint, and code review.

## T-104 — Make the inventory effect durably recoverable [concluida]

- Refs: US-065, AC-134, US-067, AC-136
- Arquivos: apps/payment-processor/src/main/java/dev/desafio/payment/inventory, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging, apps/payment-processor/src/test
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Persist the claim before the external effect and reconcile WooCommerce state on recovery. Preserve explicit domain objects; do not use an in-memory CQRS saga. Run focused tests, applicable lint, and code review.

## T-105 — Make order subscriptions distributed and replayable [concluida]
- Refs: US-066, AC-135, US-067, AC-136
- Arquivos: apps/order-workflow-subgraph/src/subscriptions, apps/order-workflow-subgraph/src/messaging, apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/src/graphql, test
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Keep GraphQL-over-SSE, replace process-local latest state with persisted replay plus cross-replica notification, and own connections through Nest lifecycle providers. Run focused tests, affected ESLint, and code review.

## T-106 — Refactor NestJS composition and close all quality gates [concluida]

- Refs: US-067, AC-136, AC-137
- Arquivos: apps/order-workflow-subgraph/src, libs/platform/nest/src, libs/gateway/nest/src, test, docs/evidence/production-happy-path-hardening, .spec/features/production-happy-path-hardening, .spec/verification/production-happy-path-hardening.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Replace the request-scoped manual object graph with ports, typed injection tokens, injectable singleton adapters, and the smallest request-scoped GraphQL context provider. Enable and use idiomatic NestJS decorator syntax instead of manual decorator function calls, while keeping explicit injection tokens at port boundaries. Move authentication/authorization into guards and context extraction into parameter decorators; use pipes, filters, interceptors, and lifecycle providers only for their proper cross-cutting roles. Promote a primitive to libs/platform/nest only when two real consumers share identical semantics. Add dependency-direction tests, review the full happy path, run all Nx ESLint targets and acceptance tests, refresh Graphify, then pass onp-spec verify and audit --ci.
