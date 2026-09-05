# Tasks: Nestjs vitest testing standard

> feature: nestjs-vitest-testing-standard

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

## T-171 — Codify the NestJS Vitest and TDD contract [concluida]
- Refs: US-104, AC-208, AC-209, AC-210, AC-211
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: AGENTS.md, .spec/constituicao.md, docs/standards/nestjs-vitest-testing.md, test/nestjs-vitest-testing-standard.test.mjs, .spec/features/nestjs-vitest-testing-standard/evidence/tdd.md
- Notas: Convert the approved prompt into concise English repository policy, add the TDD principle and executable policy evidence, and document the incremental per-library rollout without weakening existing acceptance gates. Begin with a failing policy test and record Red, Green, and Refactor evidence.

## T-172 — Install and configure shared Vitest coverage tooling [concluida]
- Refs: US-104, AC-210, AC-211
- Modelo: gpt-5.6-terra
- Esforço: medio
- Arquivos: package.json, pnpm-lock.yaml, vitest.config.ts, libs/platform/nest/project.json, libs/platform/nest/tsconfig.spec.json, libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts, test/nest-provider-composition.test.mjs, test/nestjs-vitest-testing-standard.test.mjs, .spec/features/nestjs-vitest-testing-standard/evidence/tdd.md
- Notas: Add version-aligned Nest testing and V8 coverage dependencies, configure isolated typed tests and the approved coverage floors, and expose Nx unit and coverage targets for the first reviewed library. Begin with a failing configuration contract and record Red, Green, and Refactor evidence.
