# Spec: Preserve WordPress commerce session

> feature: preserve-wordpress-commerce-session
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

## Context

The client authenticates once with one Better Auth OAuth bearer token. The
gateway validates that token, propagates the authenticated identity to the
internal GraphQL services, and exchanges it for a WordPress credential without
client involvement. The gateway currently neither captures WooCommerce session
headers returned by the WordPress subgraph nor forwards them to subsequent
WordPress requests. A cart can therefore appear in the `addToCart` response
while checkout observes an empty cart.

## User stories

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-164 — Authenticate once and continue checkout with the same cart

As a shopper using GraphiQL, I want to provide one Better Auth access token once
so that catalog, cart, checkout, payment, order events, and WordPress operations
use my identity without additional authentication, while checkout reads and
buys the same cart.

#### AC-362 — One public bearer authenticates the federated journey

- **Dado** the client provides one valid Better Auth OAuth bearer token to the gateway
- **Quando** it accesses WordPress, identity, payment, order-workflow, and subscription operations
- **Então** the gateway propagates or exchanges the verified identity automatically and no additional public authentication token is required

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-361 — WordPress session headers survive the federated round trip

- **Dado** WordPress returns `cart-token` or `woocommerce-session` for an authenticated cart request
- **Quando** the same client sends a subsequent WordPress request or starts checkout through the gateway
- **Então** the gateway returns the session headers to the client and forwards their current values to the appropriate subgraph

## Out of scope

- Changing Better Auth token issuance or weakening downstream token validation.
- Changing WooCommerce cart or checkout behavior.
- Persisting browser sessions outside the open GraphiQL page.
- Repairing checkout operations already stuck in `WOO_CREATION_REQUESTED`.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

None.

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

None.
