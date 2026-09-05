# Tasks: Harden graphql oauth resource guard

> feature: harden-graphql-oauth-resource-guard

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

## T-178 — Harden the GraphQL OAuth resource guard contract [concluida]
- Refs: US-108, AC-220
- Arquivos: libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.ts, test/harden-oauth-resource-service.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Preserve the current trust boundaries and add only missing guard-level coverage.

## T-179 — Encapsulate the OAuth subject decorator [concluida]
- Refs: US-108, AC-221
- Arquivos: libs/platform/nest/src/oauth-resource/oauth-resource.types.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-subject.decorator.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts, test/harden-oauth-resource-service.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Share the request context type and test the private decorator factory through NestJS metadata execution without adding dependencies.

## T-180 — Split GraphQL OAuth decorator unit tests [concluida]
- Refs: US-108, AC-222
- Arquivos: libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-subject.decorator.spec.ts, libs/platform/nest/src/oauth-resource/graphql/require-scopes.decorator.spec.ts, test/harden-oauth-resource-service.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Move existing tests without changing production behavior or weakening assertions.
