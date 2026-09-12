# Spec: Align wordpress cart product edge

> feature: align-wordpress-cart-product-edge
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

The Gateway composes a versioned WordPress SDL that models
`CartItem.product` as a product. The running WooGraphQL service exposes that
field as `CartItemToProductConnectionEdge`, so cart operations that select
product fields fail downstream.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-160 — Read cart product details through the Gateway

As a buyer, I want cart operations to return product details, so that I can
inspect the items that I added without a downstream schema error.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-356 — Cart product selections follow the WooGraphQL edge

- **Dado** the running WordPress schema exposes `CartItem.product` as a
  `CartItemToProductConnectionEdge`
- **Quando** the Gateway or curated MCP operations request product details for
  a cart item
- **Então** the versioned schemas and cart operations traverse `product.node`
  before selecting the product ID and name

## Fora de escopo

- Changing order line-item product relationships.
- Changing cart ownership, persistence, authentication, or session handling.
- Adding generated clients or new dependencies.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

Nenhuma.

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

Nenhuma.
