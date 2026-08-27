# Tasks: Milestone 3 — Cart and idempotent order

> feature: milestone-3-cart-order

## T-021 — Extend the schema-first commerce contract [pendente]
- Refs: US-022, US-023, US-025, AC-033, AC-034, AC-035, AC-037, AC-040
- Arquivos: libs/contracts/graphql/commerce/schema.graphql, libs/contracts/graphql/catalog/schema.graphql, libs/contracts/graphql/identity/schema.graphql, test/milestone-3-commerce-contract.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Define the minimum cart and checkout operations before resolver code. Reuse WooCommerce Order and Relay types; do not duplicate the commercial schema.

## T-022 — Adapt authenticated WooCommerce cart operations [pendente]
- Refs: US-022, AC-033, AC-034
- Arquivos: apps/commerce-subgraph/src/cart/woo-cart.port.ts, apps/commerce-subgraph/src/cart/woo-cart.adapter.ts, apps/commerce-subgraph/src/cart/cart.service.ts, test/milestone-3-cart.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Propagate the token subject through the adapter and reuse native cart mutations. Validate quantity at the application boundary; persist no second cart.

## T-023 — Add MikroORM commerce persistence and migrations [pendente]
- Refs: US-023, US-024, AC-035, AC-036, AC-037, AC-038, AC-039
- Arquivos: package.json, pnpm-lock.yaml, apps/commerce-subgraph/src/persistence/mikro-orm.config.ts, apps/commerce-subgraph/src/persistence/entities/checkout-operation.entity.ts, apps/commerce-subgraph/src/persistence/entities/order-workflow.entity.ts, apps/commerce-subgraph/src/persistence/entities/outbox-event.entity.ts, apps/commerce-subgraph/src/persistence/migrations/Migration202608270001.ts, test/milestone-3-migrations.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Pin MikroORM packages. Enforce `(subject, operationKey)` in PostgreSQL and keep Better Auth tables outside this metadata.

## T-024 — Implement concurrent idempotent checkout and recovery [pendente]
- Refs: US-023, US-024, AC-035, AC-036, AC-037, AC-038, AC-039
- Arquivos: apps/commerce-subgraph/src/checkout/command-hash.ts, apps/commerce-subgraph/src/checkout/checkout.service.ts, apps/commerce-subgraph/src/checkout/woo-order.port.ts, apps/commerce-subgraph/src/checkout/checkout.repository.ts, apps/commerce-subgraph/src/outbox/outbox.repository.ts, test/milestone-3-checkout-idempotency.test.mjs, test/milestone-3-checkout-recovery.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: This is critical concurrency and consistency work. Use a canonical command hash, the database constraint, a stable Woo reference, and one local transaction for workflow plus outbox.

## T-025 — Integrate the idempotent WooCommerce order adapter [pendente]
- Refs: US-023, US-024, AC-035, AC-038
- Arquivos: apps/commerce-subgraph/src/checkout/woo-order.adapter.ts, apps/poc-wordpress/scripts/probe-checkout.mjs, test/milestone-3-wordpress-checkout.test.mjs, docs/adrs/006-woocommerce-idempotent-checkout.md
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Prove create-or-find by a stable operation reference against the pinned plugin stack. Add only the smallest adapter required by an observed API gap.

## T-026 — Resolve cart, checkout, and workflow through federation [pendente]
- Refs: US-022, US-025, AC-033, AC-040
- Arquivos: apps/commerce-subgraph/src/graphql/commerce.module.ts, apps/commerce-subgraph/src/graphql/commerce.resolver.ts, apps/commerce-subgraph/src/app.module.ts, apps/gateway/src/catalog/order-loader.ts, apps/gateway/src/catalog/request-metrics.ts, test/milestone-3-federated-me.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Derive identity only from auth context, preserve Relay Connections, and batch order/product references per request.

## T-027 — Assemble the Milestone 3 acceptance gate [pendente]
- Refs: US-022, US-023, US-024, US-025, AC-033, AC-034, AC-035, AC-036, AC-037, AC-038, AC-039, AC-040
- Arquivos: compose.yaml, onpspec.config.json, apps/commerce-subgraph/project.json, docs/runbooks/milestone-3-cart-order.md, test/milestone-3-cart-order.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Start PostgreSQL and the pinned WordPress stack, execute the journey through the gateway, and prove sequential/concurrent retries plus the federated read. Reuse the existing harness.
