# Spec: GraphQL Relay and DataLoader closure

> feature: graphql-relay-dataloader-closure
> status: em-implementacao

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

## Context

The challenge requires every pageable list to implement the Relay Cursor
Connections contract and every entity-by-id resolution path to batch and cache
within one request. Existing evidence proves native WordPress batching but does
not prove the production Identity runtime is free from N+1 queries.

## User stories

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-100 — Navigate federated data without unstable pages or N+1 queries

As an API consumer, I want Relay-compliant user pagination and batched federated
user resolution, so that navigation remains stable and database calls do not
grow with the number of references.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-197 — User pagination exposes the complete Relay contract

- **Dado** a page of users ordered by the stable user key
- **Quando** a client requests the first page and then advances with its cursor
- **Então** each response exposes edges with opaque cursors and PageInfo with hasNextPage, hasPreviousPage, startCursor, and endCursor

#### AC-198 — Federated user references are batched per request

- **Dado** one GraphQL request containing repeated and distinct User references
- **Quando** the Identity subgraph resolves those references
- **Então** unique identifiers are fetched in one batch, duplicates use the request cache, and a later request receives a fresh loader

#### AC-199 — Runtime evidence rejects N+1 behavior

- **Dado** the production Identity GraphQL module and its request context
- **Quando** an automated federated-style query resolves multiple User references
- **Então** database query counters remain constant per request and the test fails if resolution performs one query per reference

#### AC-200 — Commercial lists preserve Relay edges through federation

- **Dado** native WPGraphQL product, cart, order, and order-item Connections
- **Quando** their contracts are composed into the supergraph and queried through Gateway
- **Então** every Connection exposes edges with cursor and node plus complete PageInfo where the source supports pagination

## Out of scope

- Replacing native WPGraphQL loaders or moving domain data into Gateway.
- Backward pagination through `last` and `before`, which is not required by the
  current user query contract.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID  | Suposição | Status | Resolução |
| --- | --------- | ------ | --------- |

None.

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID  | Pergunta | Status | Resposta |
| --- | -------- | ------ | -------- |

None.
