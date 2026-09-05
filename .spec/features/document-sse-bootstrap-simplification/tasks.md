# Tasks: Document sse bootstrap simplification

> feature: document-sse-bootstrap-simplification

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-167 — Preserve resolved SSE bootstrap evidence [concluida]

- Refs: US-101, AC-201
- Arquivos: apps/order-workflow-subgraph/src/main.ts, apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts, apps/order-workflow-subgraph/src/graphql/sse/sse.middleware.ts, apps/order-workflow-subgraph/src/graphql/sse/sse.integration.spec.ts, test/document-sse-bootstrap-simplification.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: T-189 replaced the former deferred-route TODO with Nest-owned middleware and real HTTP lifecycle proof while preserving the graphql-sse protocol.
