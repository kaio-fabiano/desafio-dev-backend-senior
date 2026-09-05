# Spec: Remove unused resource provider

> feature: remove-unused-resource-provider
> status: implementada

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

The platform library exposes an unused lifecycle abstraction that duplicates
NestJS lifecycle contracts without serving any concrete resource.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-107 — Keep the platform lifecycle API honest

As a platform maintainer, I want unused lifecycle abstractions removed so that
the public API contains only behavior used by applications.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-219 — Unused lifecycle abstraction is absent

- **Dado** the platform library has no concrete `ResourceProvider` consumers
- **Quando** the platform library is built and tested
- **Então** `ResourceProvider` and `ManagedResource` no longer exist or appear in the public API, while the remaining platform tests pass

## Fora de escopo

- Refactoring concrete PostgreSQL, RabbitMQ, or MikroORM lifecycle providers.
- Changing application startup or shutdown behavior.

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
