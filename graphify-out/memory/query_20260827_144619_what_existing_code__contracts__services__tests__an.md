---
type: "query"
date: "2026-08-27T14:46:19.739266+00:00"
question: "What existing code, contracts, services, tests, and documentation are affected by implementing Milestone 3 cart, idempotent order, MikroORM persistence, and transactional outbox?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Outbox Pattern", "Gateway GraphQL federado", "Subgraph de carrinho e pedidos", "PRD 02 — GraphQL Federation, Connections e DataLoader"]
---

# Q: What existing code, contracts, services, tests, and documentation are affected by implementing Milestone 3 cart, idempotent order, MikroORM persistence, and transactional outbox?

## Answer

Expanded from original query via graph vocabulary: [commerce, graphql, outbox]. The graph connects the Milestone 3 slice to the federated gateway, WooCommerce catalog and orders, schema-first GraphQL, the client operation key, the Commerce subgraph, the outbox pattern, and the existing E2E harness. Implementation should reuse WooCommerce for commercial data, extend Commerce with operation/workflow/outbox metadata, and prove the joined me query through the gateway.

## Outcome

- Signal: useful

## Source Nodes

- Outbox Pattern
- Gateway GraphQL federado
- Subgraph de carrinho e pedidos
- PRD 02 — GraphQL Federation, Connections e DataLoader