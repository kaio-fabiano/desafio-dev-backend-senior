# Tasks: Sonar java full analysis

> feature: sonar-java-full-analysis

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

## T-155 — Integrar e executar o SonarScanner for Gradle [concluida]
- Refs: US-097, AC-194
- Arquivos: apps/payment-federation/build.gradle.kts, apps/payment-federation/src/test/java/dev/desafio/payment/SonarConfigurationTest.java, test/sonar-java-full-analysis.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Execução sequencial confirmada pelo usuário; o scanner usa o modelo do Gradle para resolver fontes, testes, binários e bibliotecas.
