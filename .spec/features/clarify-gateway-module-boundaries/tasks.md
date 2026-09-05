# Tasks: Clarify gateway module boundaries

> feature: clarify-gateway-module-boundaries

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

## T-202 — Extract the gateway authentication module [concluida]

- Refs: US-116, AC-245
- Arquivos: libs/gateway/nest/src/auth/gateway-auth.module.ts, libs/gateway/nest/src/auth/gateway-auth.module.spec.ts, libs/gateway/nest/src/gateway.module.ts, libs/gateway/nest/src/gateway.module.spec.ts, libs/gateway/nest/src/index.ts, test/clarify-gateway-module-boundaries.spec.test.mjs, test/milestone-8-identity-gateway.test.mjs, test/oauth-resource-server-auth.spec.test.mjs, test/structural-mcp-review.test.mjs, docs/evidence/clarify-gateway-module-boundaries/T-202.md
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Red proves the intended file and module ownership and provider visibility. Green moves the existing OAuth resource registration and authentication providers into `auth/gateway-auth.module.ts`, renames the module to `GatewayAuthModule`, and leaves `gateway.module.ts` responsible for Apollo Gateway composition. Preserve the `GatewayModule` public entry point, its re-export of authentication providers for SSE middleware injection, and all runtime configuration.
