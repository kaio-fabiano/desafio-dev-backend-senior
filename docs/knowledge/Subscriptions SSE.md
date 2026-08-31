---
tags: [graphql, sse, realtime, subscriptions]
updated: 2026-08-25
---

# Subscriptions SSE

Return to [[Mapa do Projeto]]. Connects [[Saga e Idempotência]] to
[[GraphQL Federation]].

The contract is `graphql-sse`/`text-event-stream`, by `operationKey`, authenticated
before the order exists. Apollo Router documents multipart for clients; therefore,
the federated integration requires a PoC and cannot be inferred by similarity.

Details: [risk D-001](../prds/08-riscos-e-decisoes-pendentes.md#d-001--poc-obrigatória-de-subscriptions-federadas-sobre-sse).
