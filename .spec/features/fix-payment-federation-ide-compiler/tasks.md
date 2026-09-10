# Tasks: Fix Payment Federation IDE compiler diagnostics

> feature: fix-payment-federation-ide-compiler

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

## T-257 — Add the pinned Payment Federation Gradle Wrapper [concluida]
- Refs: US-137, AC-294
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: apps/payment-federation/gradlew, apps/payment-federation/gradlew.bat, apps/payment-federation/gradle/wrapper/gradle-wrapper.jar, apps/payment-federation/gradle/wrapper/gradle-wrapper.properties, test/payment-federation-gradle-wrapper.test.mjs
- Notas: Bounded context: Payment Federation build tooling (technical boundary). Use case: import and compile the module with its declared Gradle version. Aggregate: none; this changes build tooling only. Invariants: Gradle remains pinned to 8.14.3, Java remains 21, and application behavior and dependencies remain unchanged. Consistency boundary: the wrapper files and the module build definition. Affected ports: none. Red evidence must show the focused wrapper test failing because the wrapper is absent; Green generates the standard wrapper and compiles main and test sources; Refactor adds nothing unless required by a failing gate.

## T-258 — Align Payment Federation builds with Java 26 [concluida]
- Refs: US-137, AC-294, AC-295
- Modelo: gpt-5.6-terra
- Esforço: medio
- Arquivos: apps/payment-federation/build.gradle.kts, apps/payment-federation/Dockerfile, apps/payment-federation/project.json, apps/payment-federation/gradlew, apps/payment-federation/gradlew.bat, apps/payment-federation/gradle/wrapper/gradle-wrapper.jar, apps/payment-federation/gradle/wrapper/gradle-wrapper.properties, apps/payment-federation/src/test/java/dev/desafio/transaction/architecture/AxonBaselineContractTest.java, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/persistence/PostgresMigrationIntegrationTest.java, apps/e2e/project.json, test/payment-federation-gradle-wrapper.test.mjs, test/milestone-7-coverage.test.mjs, test/milestone-8-quality-gate.test.mjs
- Notas: Bounded context: Payment Federation build tooling (technical boundary). Use case: compile and test Payment Federation consistently on Java 26. Aggregate: none; this changes build configuration only. Invariants: every supported build surface uses Java 26 and Gradle 9.7.1, production behavior and dependencies remain unchanged, and the wrapper is standard generated output. Consistency boundary: Payment Federation Gradle, Docker, Nx, wrapper, and their executable repository checks. Affected ports: none. Red must record focused configuration tests failing on the current Java 21 and Gradle 8.14.3 pins; Green performs the minimum version alignment and compiles main and test sources; Refactor preserves all relevant quality gates.
