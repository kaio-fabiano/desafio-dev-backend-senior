# Spec: Harden graphql oauth resource guard

> feature: harden-graphql-oauth-resource-guard
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

The GraphQL OAuth guard already enforces authentication correctly, but its
scope, metadata precedence, cache, and error-message contracts need explicit
tests and focused documentation.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-108 — Make GraphQL authorization behavior explicit

As a platform maintainer, I want the OAuth guard contract documented and
tested so authorization changes cannot silently weaken resource protection.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-220 — Guard authorization contracts are enforced

- **Dado** a GraphQL operation protected by OAuth scope metadata
- **Quando** the guard evaluates verified or request-cached claims
- **Então** all scopes are matched case-sensitively, method metadata takes precedence, cached claims avoid repeated verification, and missing scopes use the shared forbidden message

#### AC-221 — OAuth subject decorator keeps implementation details private

- **Dado** the guard and subject decorator use the same authenticated GraphQL context
- **Quando** the decorator is resolved through the NestJS GraphQL execution pipeline
- **Então** it returns the authenticated subject without exporting its internal factory, and both components depend on one shared context type

#### AC-222 — GraphQL OAuth decorators have focused unit tests

- **Dado** each GraphQL OAuth decorator has an independent responsibility
- **Quando** the platform NestJS unit suite runs
- **Então** `OAuthSubject` and `RequireScopes` are tested in their own co-located spec files instead of the guard spec

## Fora de escopo

- Changing token signature, issuer, audience, time, algorithm, or JWKS verification in `OAuthResourceService`.
- Protecting non-GraphQL transports with this GraphQL-specific guard.

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
