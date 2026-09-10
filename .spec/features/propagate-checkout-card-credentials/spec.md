# Spec: Propagate checkout card credentials

> feature: propagate-checkout-card-credentials
> status: rascunho

## Contexto

Card checkout validates and hashes the short-lived Mercado Pago token and
payment-method identifier, but the asynchronous Transaction and Inventory path
replaces them with values derived from `paymentId`. The provider therefore does
not receive the credentials accepted at the GraphQL boundary.

## Histórias

### US-145 — Preserve tokenized Card payment intent

As a buyer, I want the tokenized Card intent accepted by checkout to reach the
Mercado Pago adapter unchanged, so the asynchronous payment authorizes the
selected Card instead of using a synthetic reference.

#### AC-314 — Carry only tokenized Card credentials to Payment

- **Dado** a Card checkout with a short-lived provider token and provider payment-method identifier
- **Quando** Transaction, outbox, RabbitMQ, and Inventory advance the checkout to Payment
- **Então** the resulting payment command contains those exact two values, while Pix contains neither and PAN or security-code fields remain prohibited

#### AC-315 — Preserve idempotency while carrying Card credentials

- **Dado** repeated delivery of one logical Card checkout
- **Quando** the asynchronous workflow retries
- **Então** the existing transaction and payment operation keys remain unchanged and the provider receives one idempotent logical request

## Fora de escopo

- Collecting PAN, CVV, security codes, or raw Card payloads.
- Building a frontend tokenizer or changing Mercado Pago credentials.
- Changing payment ordering, settlement policy, or the provider-effect recovery feature already present in the worktree.
- Running unrelated end-to-end or whole-system test suites.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-116 | The existing accepted ADR permits the short-lived provider token and payment-method identifier to cross the durable asynchronous workflow while continuing to prohibit raw Card data. | confirmada | AC-161 explicitly requires the tokenized Card command to cross GraphQL, RabbitMQ, persistence, and the provider adapter. |

## Perguntas em aberto

Nenhuma.
