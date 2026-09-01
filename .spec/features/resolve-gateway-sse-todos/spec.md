# Spec: Integrate gateway SSE with NestJS

> feature: resolve-gateway-sse-todos
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

The gateway currently registers `/graphql/stream` imperatively during bootstrap
and gives its SSE handler a second copy of the token configuration. This leaves
the streaming endpoint outside NestJS dependency injection even though the
gateway already owns a `TokenVerifierService` backed by Better Auth.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-062 — Reuse the gateway authentication boundary for subscriptions

As a gateway maintainer, I want streaming routes to be registered by reusable
NestJS middleware and authenticated by the existing token verifier, so that HTTP
and SSE entry points share one authentication policy without bootstrap wiring.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-130 — NestJS owns the authenticated SSE route

- **Dado** the gateway exposes the GraphQL SSE endpoint and already provides `TokenVerifierService`
- **Quando** the NestJS application initializes the streaming route
- **Então** the route is registered outside bootstrap through reusable NestJS middleware and every SSE authentication attempt delegates to the injected `TokenVerifierService`

## Fora de escopo

- Changing the public `/graphql/stream` protocol or URL.
- Replacing `graphql-sse` or the commerce subscription client.
- Introducing a second token verifier or moving Better Auth validation out of the gateway authentication library.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID      | Suposição                                                                               | Status     | Resolução                                                                                   |
| ------- | --------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| ASM-048 | NestJS middleware can preserve the native response lifecycle required by `graphql-sse`. | confirmada | Express request and response objects implement the Node HTTP types consumed by the handler. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID  | Pergunta | Status     | Resposta                                                  |
| --- | -------- | ---------- | --------------------------------------------------------- |
| —   | Nenhuma. | respondida | The requested TODOs map to existing gateway abstractions. |
