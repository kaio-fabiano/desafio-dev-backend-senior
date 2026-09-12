# Tasks: Connect GraphiQL to GraphQL SSE

> feature: connect-graphiql-sse

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

## T-309 — Serve an SSE-aware GraphiQL page [pendente]

- Refs: US-162, AC-359
- Arquivos: apps/gateway/src/graphiql/gateway-graphiql-page.spec.ts, apps/gateway/src/graphiql/gateway-graphiql-page.ts, apps/gateway/src/main.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Edge. Use case: serve the local GraphiQL explorer with GraphQL-over-SSE subscription transport. Aggregate: none; this is presentation and transport composition. Invariants: queries and mutations continue through `/graphql`; subscriptions use `/graphql/stream`; GraphiQL forwards user-entered authorization headers; no WebSocket or business state is introduced. Consistency boundary: one browser GraphQL operation routed to exactly one transport. Affected ports: none; the existing SSE middleware and subscription application port remain unchanged. TDD: prove the served page selects the SSE client for subscriptions before wiring it into bootstrap.
