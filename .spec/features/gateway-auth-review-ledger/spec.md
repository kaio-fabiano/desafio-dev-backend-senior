# Spec: Gateway auth review ledger

> feature: gateway-auth-review-ledger
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

The gateway authentication review has been implemented. Its durable ledger
must preserve every finding, resolution, and link from the affected source
files.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-102 — Track gateway authentication review findings

As a maintainer, I want the gateway authentication findings tracked in the
repository so that future hardening work has one review source of truth.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-202 — Review ledger is discoverable from affected code

- **Dado** the resolved gateway authentication review
- **Quando** a maintainer inspects the gateway authentication, token verification, federation data source, or module
- **Então** a concise review link points to an English repository ledger containing all twenty numbered findings and their resolved status

## Fora de escopo

- Reopening or extending the completed authentication hardening scope.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID  | Suposição | Status | Resolução |
| --- | --------- | ------ | --------- |

Nenhuma.

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID    | Pergunta                                                     | Status     | Resposta                                                                             |
| ----- | ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| Q-012 | Must every gateway GraphQL operation require authentication? | respondida | Yes. `/graphql` remains private and authentication fails before operation execution. |
