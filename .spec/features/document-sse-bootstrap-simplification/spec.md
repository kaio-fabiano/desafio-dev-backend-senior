# Spec: Document sse bootstrap simplification

> feature: document-sse-bootstrap-simplification
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

The former bootstrap registered the GraphQL SSE route after Nest had already
installed its HTTP routing stack. Nest now owns the graphql-sse middleware
during module configuration, and an HTTP integration test preserves startup,
authentication, streaming, disconnect, and shutdown behavior.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-101 — Preserve the resolved SSE bootstrap behavior

As a maintainer, I want the resolved SSE bootstrap behavior to remain
discoverable so future refactors preserve the protocol and lifecycle contract.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-201 — Nest-owned SSE route is active after startup

- **Dado** que a aplicação order workflow foi inicializada pelo Nest
- **Quando** um cliente autenticado abre uma assinatura GraphQL SSE
- **Então** a rota deve transmitir eventos com o protocolo graphql-sse e liberar seus recursos no encerramento

## Fora de escopo

- Changing the published GraphQL schema or graphql-sse wire protocol.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID  | Suposição | Status | Resolução |
| --- | --------- | ------ | --------- |

Nenhuma.

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID  | Pergunta | Status | Resposta |
| --- | -------- | ------ | -------- |

Nenhuma.
