# Spec: Stabilize platform nest public api

> feature: stabilize-platform-nest-public-api
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

The platform NestJS package needs an explicit, tested public entrypoint so
consumers depend only on supported OAuth contracts while implementation tokens
remain private.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-110 — Stabilize the shared NestJS entrypoint

As a platform consumer, I want a small supported package API so refactors of
OAuth internals do not silently break applications or expose injection details.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-224 — Public entrypoint excludes removed platform abstractions

- **Dado** applications consume the platform NestJS package through its declared subpath
- **Quando** the package entrypoint contract is inspected
- **Então** it points to the platform barrel and excludes provider tokens and removed configuration or lifecycle abstractions

## Fora de escopo

- Adding independent package subpaths.
- Publishing the workspace package to a registry.

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
