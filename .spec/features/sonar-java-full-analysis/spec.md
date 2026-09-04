# Spec: Sonar java full analysis

> feature: sonar-java-full-analysis
> status: rascunho

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Contexto

O módulo Java é analisado pelo SonarQube for IDE arquivo a arquivo, sem o classpath Gradle, produzindo alertas incompletos e potencialmente imprecisos.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-097 — Análise Java completa e reproduzível

Como mantenedor, quero executar o Sonar através do Gradle, para analisar todas as fontes e testes com bytecode e dependências corretos antes do deploy.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-194 — Scanner integrado ao ciclo Gradle

- **Dado** o módulo `payment-federation` baseado em Gradle e Java 21
- **Quando** sua configuração de qualidade é validada
- **Então** o plugin oficial do Sonar está disponível e a tarefa `sonar` depende da compilação e dos testes do módulo

## Fora de escopo

- Corrigir os problemas encontrados pela análise.
- Configurar ou publicar um servidor SonarQube compartilhado.
- Fazer deploy da aplicação.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
Nenhuma.

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
