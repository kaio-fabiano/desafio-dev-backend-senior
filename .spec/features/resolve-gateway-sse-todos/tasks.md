# Tasks: Integrate gateway SSE with NestJS

> feature: resolve-gateway-sse-todos

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

## T-101 — Register and authenticate gateway SSE through NestJS [concluida]
- Refs: US-062, AC-130
- Arquivos: apps/gateway/project.json, apps/gateway/src/main.ts, apps/gateway/src/app.module.ts, apps/gateway/src/subscriptions/sse-handler.ts, apps/gateway/src/subscriptions/sse.middleware.ts, test/remove-wordpress-federation-runtime.spec.test.mjs, test/resolve-gateway-sse-todos.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Reuse `TokenVerifierService`; keep the raw request and response lifecycle inside route-scoped NestJS middleware because `graphql-sse` controls the stream.
