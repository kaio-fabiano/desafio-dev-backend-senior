# Tasks: Restore local e2e gateway runtime

> feature: restore-local-e2e-gateway-runtime

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

## T-302 — Restore the local Gateway runtime boundary [pendente]

- Refs: US-157, AC-351
- Arquivos: compose.yaml, test/milestone-7-e2e-contract.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Red asserts the local and AWS runtime split; Green is the smallest Compose-only configuration change. Preserve the production DPoP fail-closed test and SST DynamoDB binding.
