# Spec: Remove wordpress federation runtime

> feature: remove-wordpress-federation-runtime
> status: pronta

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

The `wp-graphql-federations` plugin already turns WPGraphQL into an Apollo
Federation v2 subgraph. The additional NestJS WordPress proxy duplicates that
boundary, owns a second subscription implementation, and makes the runtime
topology harder to explain. WordPress must be composed directly while Commerce
remains the single owner of the order-event stream.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-059 — Compose WordPress directly

As a platform operator, I want the gateway to compose the plugin-provided
WPGraphQL endpoint directly, so that federation does not require a redundant
NestJS proxy runtime.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-117 — Direct plugin subgraph

- **Dado** a WordPress installation with WPGraphQL and `wp-graphql-federations`
- **Quando** the platform starts and composes its supergraph
- **Então** the WordPress routing URL targets the native `/graphql` endpoint and composition succeeds without `apps/wordpress-federation`

#### AC-118 — Single subscription owner

- **Dado** the order-event stream is published by Commerce
- **Quando** a client subscribes through the gateway SSE endpoint
- **Então** the gateway delegates only to Commerce and no WordPress NestJS subscription implementation remains

#### AC-119 — Reduced deployable topology

- **Dado** the platform project and container inventories
- **Quando** their architecture contracts are validated
- **Então** no WordPress Federation Node.js application or `wordpress-nest` library is deployed, built, or exported

#### AC-120 — WordPress capabilities preserved

- **Dado** the direct plugin-first WordPress subgraph
- **Quando** catalog, entity, identity-link, and inventory integration contracts are checked
- **Então** they use native WordPress/WPGraphQL endpoints without adding duplicate commercial models or custom federation middleware

## Fora de escopo

- Modify or fork `wp-graphql-federations`.
- Move authoritative commercial data out of WordPress/WooCommerce.
- Redesign Commerce checkout, Payment invariants, or Better Auth identity.
- Add a replacement proxy, wrapper subgraph, or custom federation schema.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-043 | Commerce is the sole owner of the order-event subscription because the gateway already delegates its SSE endpoint to Commerce. | confirmada | Confirmed by the user after reviewing the duplicate WordPress runtime. |
| ASM-044 | The plugin-produced SDL can compose directly after reproducible plugin configuration; any remaining schema incompatibility must be fixed at that source rather than by retaining a general proxy. | confirmada | The user explicitly selected the plugin-first simplification. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
