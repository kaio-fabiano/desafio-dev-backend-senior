---
type: "query"
date: "2026-08-27T15:44:08.906086+00:00"
question: "Define the smallest Milestone 4 payment inventory saga slice and its integration points"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Saga coreografada de pagamento e estoque", "Consistência por Outbox e Inbox", "Processador de pagamento em runtime separado", "Subgraph de carrinho e pedidos"]
---

# Q: Define the smallest Milestone 4 payment inventory saga slice and its integration points

## Answer

Expanded from original query via graph vocabulary: checkout, commerce, inbox, outbox, rabbit, saga. The existing checkout outbox is the entry point; RabbitMQ confirmed publication connects Commerce to a separate Java payment processor and a WooCommerce inventory worker; inbox records protect each local effect; Commerce owns monotonic workflow transitions and compensation. Pix ends at code generation without inventory reservation in this milestone.

## Outcome

- Signal: useful

## Source Nodes

- Saga coreografada de pagamento e estoque
- Consistência por Outbox e Inbox
- Processador de pagamento em runtime separado
- Subgraph de carrinho e pedidos