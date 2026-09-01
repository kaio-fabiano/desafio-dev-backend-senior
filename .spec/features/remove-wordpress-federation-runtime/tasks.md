# Tasks: Remove wordpress federation runtime

> feature: remove-wordpress-federation-runtime

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

## T-001 — Define direct WordPress federation acceptance contracts [concluida]
- Refs: US-059, AC-117, AC-118, AC-119, AC-120
- Arquivos: test/remove-wordpress-federation-runtime.spec.test.mjs, test/five-app-topology.test.mjs, test/federated-platform-refactor.test.mjs, test/architecture-boundaries.test.mjs, test/gateway-federation-refactor.test.mjs, apps/e2e/src/milestone-7.e2e.test.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Replace proxy-presence assertions with behavior and absence assertions before implementation.

## T-002 — Route integrations directly to native WordPress [concluida]
- Refs: US-059, AC-117, AC-120
- Arquivos: libs/gateway/nest/src/gateway.module.ts, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/contracts/graphql/supergraph.yaml, compose.yaml, apps/wordpress-integration/compose.yaml, apps/wordpress-integration/scripts/install-plugins.sh, apps/payment-processor/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java, apps/payment-processor/src/main/java/dev/desafio/payment/inventory/WooInventoryAdapter.java, apps/payment-processor/src/main/java/dev/desafio/payment/wordpress/WpGraphqlAuthentication.java, apps/e2e/src/environment.ts
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Preserve authentication trust boundaries and plugin bootstrap with direct Origin propagation and site-token exchange while removing the Node.js hop.

## T-003 — Remove the redundant WordPress NestJS runtime [concluida]
- Refs: US-059, AC-118, AC-119
- Arquivos: package.json, tsconfig.base.json, tsconfig.json, test/remove-wordpress-federation-runtime.spec.test.mjs, test/typescript-editor-stability.test.mjs, test/milestone-7-nx-quality.test.mjs, test/milestone-7-containers.test.mjs, test/milestone-7-e2e-contract.test.mjs, test/milestone-8-real-e2e.test.mjs, test/delivery-closure-inventory-saga.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Deletion includes the user's current formatting-only changes in libs/wordpress/nest/src/index.ts; apps/gateway/src/main.ts remains untouched.

## T-004 — Align architecture documentation with the plugin-first topology [concluida]
- Refs: US-059, AC-117, AC-118, AC-119, AC-120
- Arquivos: README.md, docs/adrs/003-wordpress-federation.md, docs/adrs/007-federated-platform-boundaries.md, docs/adrs/README.md, docs/prds/01-arquitetura-e-dominio.md, docs/knowledge/Mapa do Projeto.md, docs/runbooks/local-development.md, docs/runbooks/e2e.md, docs/evidence/federated-platform-refactor/review.md
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Describe WordPress as an external plugin-provided subgraph, not a deployable application.
