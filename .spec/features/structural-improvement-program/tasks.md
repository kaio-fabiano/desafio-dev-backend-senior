# Tasks: Structural improvement program

> feature: structural-improvement-program

## T-092 — Review and improve Gateway boundaries [concluida]

- Refs: US-060, AC-121
- Arquivos: apps/gateway, libs/gateway/nest, apps/identity-subgraph/Dockerfile, test/gateway-federation-refactor.test.mjs, test/milestone-6-mcp-propagation.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/structural-gateway-review.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Execute first because downstream structures depend on the edge contract.

## T-093 — Review and improve Identity boundaries [concluida]

- Refs: US-060, AC-122
- Arquivos: apps/identity-subgraph, libs/identity/nest, libs/gateway/nest, compose.yaml, test/identity-federation-refactor.test.mjs, test/structural-identity-review.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: May run in parallel after the Gateway review.

## T-094 — Review and improve Commerce workflow boundaries [concluida]

- Refs: US-060, AC-123
- Arquivos: apps/order-workflow-subgraph, test/delivery-closure-rabbitmq.test.mjs, test/structural-commerce-review.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Run after Gateway findings establish the stable subscription edge.

## T-095 — Review and improve Payment boundaries [concluida]

- Refs: US-060, AC-124
- Arquivos: apps/payment-processor, compose.yaml, test/structural-payment-review.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Run after Commerce findings establish the stable choreography contract.

## T-096 — Review and improve WordPress integration [concluida]

- Refs: US-060, AC-125
- Arquivos: apps/wordpress-integration, compose.yaml, test/structural-wordpress-review.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: May run in parallel with Identity and MCP after the Gateway review.

## T-097 — Review and improve Apollo MCP boundaries [concluida]

- Refs: US-060, AC-126
- Arquivos: apps/apollo-mcp, apps/gateway/src/main.ts, libs/gateway/nest, test/structural-mcp-review.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: May run in parallel with Identity and WordPress after the Gateway review.

## T-098 — Review shared platform and infrastructure [concluida]

- Refs: US-060, AC-127
- Arquivos: libs/platform/nest, compose.yaml, nx.json, package.json, tsconfig.base.json, .github, test/structural-platform-review.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Integrate after application findings so shared code is justified by actual consumers.

## T-099 — Reconcile end-to-end evidence and documentation [concluida]

- Refs: US-060, AC-128
- Arquivos: apps/e2e, README.md, docs, .spec/features/structural-improvement-program, test/structural-improvement-program.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notes: Final sequential wave after every application improvement.
