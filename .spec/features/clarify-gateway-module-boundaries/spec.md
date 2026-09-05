# Spec: Clarify gateway module boundaries

> feature: clarify-gateway-module-boundaries
> status: auditada

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

The gateway package currently declares its authentication providers and the
Apollo Gateway composition module in the same source file. Both NestJS modules
have valid responsibilities, but their co-location makes the package boundary
look accidental and obscures which module owns OAuth resource verification.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-116 — Make gateway module ownership explicit

As a maintainer, I want gateway authentication and federation composition in
focused folders, so that each NestJS module has an obvious responsibility and
can evolve independently.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-245 — Authentication has a focused NestJS module

- **Dado** the Apollo Gateway context and the SSE middleware share the gateway authentication providers
- **Quando** a maintainer inspects or compiles the gateway package
- **Então** `GatewayAuthModule` owns OAuth verification and authentication providers under `auth/`, while `GatewayModule` owns only Apollo Gateway composition and continues exporting the authentication module without changing runtime behavior

## Fora de escopo

- Changing token validation, audiences, scopes, GraphQL routing, or SSE behavior.
- Introducing additional abstraction layers or splitting the existing auth providers further.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID      | Suposição                                                                                                            | Status     | Resolução                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ASM-082 | The existing `GatewayAuthProvidersModule` is not a supported external API and may be renamed to `GatewayAuthModule`. | confirmada | Repository references show that only the package barrel exports the old name; application composition imports `GatewayModule`. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID  | Pergunta | Status | Resposta |
| --- | -------- | ------ | -------- |

Nenhuma.
