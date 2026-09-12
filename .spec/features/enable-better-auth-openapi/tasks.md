# Tasks: Enable Better Auth OpenAPI

> feature: enable-better-auth-openapi

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

## T-306 — Enable Better Auth OpenAPI reference [pendente]

- Refs: US-159, AC-355
- Arquivos: libs/identity/nest/src/better-auth/better-auth.factory.spec.ts, libs/identity/nest/src/better-auth/better-auth.factory.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Identity. Use case: expose the Better Auth API reference for local/manual endpoint exploration. Aggregate: none; this is outer-layer authentication composition. Invariants: existing authentication endpoints, OAuth scopes, JWT configuration, and persistence remain unchanged; only the official OpenAPI plugin is appended. Consistency boundary: one immutable Better Auth configuration instance. Affected ports: none. TDD: first prove that `/api/auth/reference` is unavailable, then enable the bundled `openAPI()` plugin and preserve the relevant suite.
