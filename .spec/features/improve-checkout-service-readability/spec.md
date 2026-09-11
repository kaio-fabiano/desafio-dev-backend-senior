# Spec: Improve checkout service readability

> feature: improve-checkout-service-readability
> status: rascunho

## Contexto

`CheckoutService.checkout` mistura aquisição de lease, espera concorrente,
reconciliação do pedido WooCommerce, início da transação e liberação em caso
de erro. O fluxo deve ser separado em métodos privados com nomes explícitos,
sem alterar o comportamento observável.

## Histórias

### US-146 — Tornar o fluxo de checkout legível

Como mantenedor, quero ler o checkout em etapas nomeadas, para compreender sua
coordenação sem decodificar todos os detalhes no método público.

#### AC-316 — Refatoração preserva o comportamento do checkout

- **Dado** o fluxo atual de checkout idempotente
- **Quando** suas etapas são extraídas para métodos privados nomeados
- **Então** credenciais, concorrência, conflitos, espera limitada e reconciliação continuam com os mesmos resultados observáveis

## Fora de escopo

- Alterar regras, estados, tempos, contratos ou persistência do checkout.
- Criar novas classes, interfaces ou dependências.

## Suposições

Nenhuma.

## Perguntas em aberto

Nenhuma.
