# Tasks: Order workflow boundary refactor

> feature: transaction-federation-refactor

## T-108 — Provar capacidades nativas e fronteiras [concluida]
- Refs: US-068, AC-139, AC-140, US-069, AC-141, AC-142
- Arquivos: test/order-workflow-boundaries.test.mjs, test/wordpress-native-commerce.test.mjs, libs/contracts/graphql/wordpress/schema.graphql
- Modelo: gpt-5.6-sol
- Esforço: alto

## T-109 — Renomear Commerce para Order Workflow [concluida]
- Refs: US-069, AC-141, AC-142
- Arquivos: apps/order-workflow-subgraph, libs/contracts/graphql/order-workflow, package.json, pnpm-lock.yaml, nx.json, tsconfig.json, tsconfig.base.json
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Preservar história Git quando possível; não remover o runtime.

## T-110 — Remover wrappers e delegar ao WooGraphQL [concluida]
- Refs: US-068, AC-139, AC-140, US-070, AC-143, AC-144
- Arquivos: apps/order-workflow-subgraph/src/cart, apps/order-workflow-subgraph/src/checkout, apps/order-workflow-subgraph/src/graphql, libs/contracts/graphql/order-workflow/schema.graphql, apps/order-workflow-subgraph/src/checkout
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Manter apenas a fachada idempotente que delega checkout nativo.

## T-111 — Simplificar saga e preservar SSE no Order Workflow [concluida]
- Refs: US-070, AC-143, AC-144, AC-145, US-071, AC-146, AC-147
- Arquivos: apps/order-workflow-subgraph/src/saga, apps/order-workflow-subgraph/src/inbox, apps/order-workflow-subgraph/src/outbox, apps/order-workflow-subgraph/src/subscriptions, apps/order-workflow-subgraph/src/persistence, apps/order-workflow-subgraph/src/messaging
- Modelo: gpt-5.6-sol
- Esforço: alto

## T-112 — Isolar Payment, Inventory e porta de provedor [concluida]
- Refs: US-070, AC-145, US-072, AC-148, AC-149
- Arquivos: apps/payment-processor/src/main/java/dev/desafio/payment, apps/payment-processor/src/main/java/dev/desafio/payment/inventory, apps/payment-processor/src/test/java/dev/desafio/payment, apps/payment-processor/src/test/java/dev/desafio/payment/inventory
- Modelo: gpt-5.6-sol
- Esforço: alto

## T-113 — Reconectar Gateway, MCP, compose e supergraph [concluida]
- Refs: AC-139, AC-141, AC-146, AC-147
- Arquivos: apps/gateway, libs/gateway, apps/apollo-mcp, compose.yaml, libs/contracts/graphql/supergraph.yaml, test/gateway-federation-refactor.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto

## T-114 — Registrar ADRs e plano do pagamento real [concluida]
- Refs: US-072, AC-148, AC-149, US-073, AC-150
- Arquivos: docs/adrs/008-native-commerce-and-order-workflow.md, docs/adrs/009-payment-provider-port.md, README.md, docs/prds/01-arquitetura-e-dominio.md, docs/prds/04-commerce-saga-e-realtime.md
- Modelo: gpt-5.6-luna
- Esforço: baixo

## T-115 — Fechar E2E, ESLint, composição e auditoria [concluida]
- Refs: AC-143, AC-144, AC-145, AC-146, AC-147, AC-151
- Arquivos: apps/e2e/src/journey.ts, test/order-workflow-e2e.test.mjs, test/order-workflow-architecture.test.mjs, .spec/verification/transaction-federation-refactor.json
- Modelo: gpt-5.6-sol
- Esforço: alto
