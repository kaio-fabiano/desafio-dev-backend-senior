# Tasks: Gateway auth review ledger

> feature: gateway-auth-review-ledger

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

## T-168 — Add the gateway authentication review ledger [concluida]

- Refs: US-102, AC-202
- Arquivos: docs/reviews/gateway-auth-refactor.md, libs/gateway/nest/src/auth/auth-context.factory.ts, libs/gateway/nest/src/auth/token-verifier.service.ts, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/gateway/nest/src/gateway.module.ts, test/gateway-auth-review-ledger.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Sequential execution approved by the user. T-184 later resolved the findings while preserving this ledger's lifecycle evidence.
