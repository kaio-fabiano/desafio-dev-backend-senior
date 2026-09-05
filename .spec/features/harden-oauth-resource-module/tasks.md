# Tasks: Harden oauth resource module

> feature: harden-oauth-resource-module

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

## T-181 — Harden OAuth dynamic module composition [concluida]
- Refs: US-109, AC-223
- Arquivos: libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts, test/harden-oauth-resource-service.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Use idiomatic NestJS decorators, immutable option snapshots, and TestingModule integration coverage.
