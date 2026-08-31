# Tasks: Challenge compliance and delivery closure

> feature: delivery-closure

## T-085 — Encode the immutable challenge compliance gate [concluida]
- Refs: US-055, AC-109
- Arquivos: docs/evidence/challenge-compliance.md, test/challenge-compliance-contract.test.mjs, test/five-app-topology.test.mjs, test/milestone-8-real-e2e.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notes: Replace self-referential topology assertions with a README-to-runtime matrix that fails on missing mandatory components or assertions.

## T-086 — Restore durable checkout and RabbitMQ choreography [concluida]
- Refs: US-056, AC-110
- Arquivos: apps/commerce-subgraph, libs/contracts/graphql/commerce/schema.graphql, libs/contracts/events, compose.yaml, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, nx.json, test/delivery-closure-rabbitmq.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Restore the smallest proven Commerce/outbox implementation from pre-`a2a37a3`, keep WooCommerce authoritative, and adapt it to current federation boundaries.

## T-087 — Reactivate the Java Payment Federation event runtime [concluida]
- Refs: US-056, AC-111
- Arquivos: apps/payment-processor/build.gradle.kts, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging, apps/payment-processor/src/main/resources, apps/payment-processor/src/test, test/delivery-closure-payment-runtime.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Remove the messaging source exclusion, restore Spring AMQP dependencies/configuration, and prove database idempotency, confirms, acknowledgements, bounded retry, and DLQ.

## T-088 — Add inventory reaction and compensation to Payment Federation [pendente]

- Refs: US-056, AC-112
- Arquivos: apps/payment-processor/src/main/java/dev/desafio/payment/inventory, apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging, apps/payment-processor/src/test, apps/wordpress-integration, libs/contracts/events, compose.yaml, test/delivery-closure-inventory-saga.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Port the proven stock-worker behavior from pre-`a2a37a3` behind an internal Java application boundary; retain WooCommerce as stock authority without creating another deployable service.

## T-089 — Repair the complete Testcontainers acceptance journey [pendente]

- Refs: US-057, AC-113, AC-114
- Arquivos: apps/e2e/src/environment.ts, apps/e2e/src/journey.ts, apps/e2e/src/milestone-7.e2e.test.ts, apps/e2e/project.json, libs/contracts/graphql/supergraph.yaml, test/milestone-7-e2e-contract.test.mjs, test/milestone-8-real-e2e.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Start RabbitMQ and the Payment Federation consumers, remove direct payment orchestration from the client, query full federated `me`, prove checkout replay and compensation, and retain MCP parity/negative cases.

## T-090 — Add optional end-to-end observability [pendente]

- Refs: US-058, AC-115
- Arquivos: package.json, pnpm-lock.yaml, libs/platform/nest/src, apps/gateway/src/main.ts, apps/identity-subgraph/src/main.ts, apps/commerce-subgraph/src, apps/wordpress-federation/src/main.ts, apps/payment-processor, compose.yaml, infra/observability/otel-collector.yaml, docs/runbooks/observability.md, test/delivery-closure-observability.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Use standard OpenTelemetry propagation and an opt-in local collector/backend; instrument the restored RabbitMQ path rather than a reduced topology.

## T-091 — Reconcile documentation and close every gate [pendente]

- Refs: US-058, AC-116
- Arquivos: README.md, docs/evidence/challenge-compliance.md, docs/evidence/milestone-8/requirements.md, docs/prds/08-riscos-e-decisoes-pendentes.md, docs/adrs/004-restricoes-de-entrega.md, docs/adrs/007-federated-platform-boundaries.md, docs/runbooks, .spec/features/milestone-6-apollo-mcp/spec.md, .spec/features/milestone-7-e2e-deployment/spec.md, .spec/features/delivery-closure/spec.md, .spec/features/delivery-closure/tasks.md, .spec/verification/delivery-closure.json, libs/wordpress/nest/src/federation/wordpress-federation.module.ts
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Preserve the staged import-order correction, incorporate the owner deadline answer, run all quality and acceptance gates, verify, audit, and remove generated Graphify query state from the delivery.
