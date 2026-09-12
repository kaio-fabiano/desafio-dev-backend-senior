# Tasks: Preserve wordpress commerce session

> feature: preserve-wordpress-commerce-session

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

## T-311 — Preserve WordPress commerce headers through the gateway [pendente]

- Refs: US-164, AC-361, AC-362
- Arquivos: libs/gateway/nest/src/federation/gateway-federation.configuration.ts, libs/gateway/nest/src/gateway-path.integration.spec.ts, libs/gateway/nest/src/gateway.module.spec.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Bounded context: Edge. Use case: single-token federated authentication with transparent commerce-session transport. Aggregate: none; this is authentication and transport configuration. Invariants: the client supplies only one Better Auth bearer; each downstream service receives the verified identity through its existing bearer or WordPress credential exchange; WordPress response session headers are returned to the client; commerce session headers are forwarded only to session-aware subgraphs. Consistency boundary: one authenticated GraphQL journey and the request/response pairs carrying its commerce session. Affected ports: existing token verifier and WordPress credential ports are reused unchanged. Red: add a focused integration test annotated `@spec:AC-361` and `@spec:AC-362` that fails while WordPress lacks request/response session capabilities or requires client-side secondary authentication. Green: enable the existing capabilities for WordPress with the smallest configuration change. Refactor: run the focused suite, typecheck, lint, coverage, verify, and audit gates.
