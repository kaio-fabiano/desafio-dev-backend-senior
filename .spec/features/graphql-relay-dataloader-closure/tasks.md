# Tasks: GraphQL Relay and DataLoader closure

> feature: graphql-relay-dataloader-closure

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

## T-163 — Prove complete Relay pagination [concluida]

- Refs: US-100, AC-197
- Arquivos: libs/contracts/graphql/identity/schema.graphql, libs/identity/nest/src/graphql/identity.resolver.ts, test/graphql-relay-dataloader-closure.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Preserve datasource-level keyset pagination and add the missing PageInfo fields.

## T-164 — Batch Identity references per request [concluida]

- Refs: US-100, AC-198
- Arquivos: libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/graphql/identity.resolver.ts, libs/identity/nest/src/graphql/user.loader.ts, test/graphql-relay-dataloader-closure.test.mjs, test/identity-federation-refactor.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Reuse the installed DataLoader package if available; never share a cache across requests.

## T-165 — Prove the production runtime has no N+1 path [concluida]

- Refs: US-100, AC-199
- Arquivos: test/graphql-relay-dataloader-closure.test.mjs, test/challenge-compliance-contract.test.mjs, docs/evidence/challenge-compliance.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Count datasource calls through the real NestJS resolver/context wiring rather than testing an unused loader.

## T-166 — Preserve commercial Relay edges through federation [concluida]
- Refs: US-100, AC-200
- Arquivos: libs/contracts/graphql/wordpress/schema.graphql, apps/apollo-mcp/schema.graphql, apps/e2e/src/journey.ts, apps/wordpress-integration/scripts/probe.mjs, test/graphql-relay-dataloader-closure.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Delegate pagination to native WPGraphQL and expose its edge contract without adding Gateway resolvers.
