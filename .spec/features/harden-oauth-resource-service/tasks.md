# Tasks: Harden oauth resource service

> feature: harden-oauth-resource-service

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

## T-173 — Harden OAuth resource verification through TDD [concluida]
- Refs: US-105, AC-212, AC-213, AC-214, AC-215
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts, libs/platform/nest/src/oauth-resource/oauth-resource.tokens.ts, libs/platform/nest/src/oauth-resource/oauth-resource.types.ts, libs/platform/nest/src/oauth-resource/verification/oauth-request.adapter.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts, libs/platform/nest/src/index.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.integration.spec.ts, test/harden-oauth-resource-service.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, package.json, onpspec.config.json, vitest.config.ts, .spec/features/harden-oauth-resource-service/evidence/tdd.md
- Notas: Execute directly with the current chat model. Start with focused failing Vitest tests, retain Better Auth verification and caching, add no external network, and close with critical coverage, typecheck, lint, verify, and audit.

## T-174 — Remove unsafe claim casting and classify authentication failures [concluida]
- Refs: US-105, AC-212, AC-181
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.ts, test/harden-oauth-resource-service.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, .spec/features/harden-oauth-resource-service/evidence/tdd.md
- Notas: Remove the local access-token assertion, preserve Better Auth inference, and map only typed credential failures to 401 while allowing JWKS and unexpected failures to propagate as server errors.

## T-175 — Organize the OAuth resource feature by responsibility [concluida]
- Refs: US-105, AC-215
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts, libs/platform/nest/src/oauth-resource/graphql/oauth-subject.decorator.ts, libs/platform/nest/src/oauth-resource/graphql/require-scopes.decorator.ts, libs/platform/nest/src/oauth-resource/verification/oauth-request.adapter.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.errors.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.integration.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts, libs/platform/nest/src/oauth-resource/oauth-resource.module.ts, libs/platform/nest/src/oauth-resource/oauth-resource.tokens.ts, libs/platform/nest/src/oauth-resource/oauth-resource.types.ts, libs/platform/nest/src/index.ts, test/harden-oauth-resource-service.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, test/identity-federation-refactor.test.mjs, test/production-happy-path-hardening.spec.test.js, test/structural-identity-review.test.mjs, vitest.config.ts, .spec/features/harden-oauth-resource-service/evidence/tdd.md
- Notas: Move the cohesive OAuth resource feature out of the generic auth folder, group verification and GraphQL integration separately, extract the two GraphQL decorators, preserve public exports and runtime behavior, and keep the established critical coverage thresholds.
