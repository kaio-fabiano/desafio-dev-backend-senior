# Spec: Propagate checkout payer email

> feature: propagate-checkout-payer-email
> status: rascunho

## Context

Checkout accepts a payer email separately from the authenticated owner, but
Transaction currently drops that email and publishes the owner identifier as
`payerEmail`. Mercado Pago consequently receives an OAuth subject instead of
the payer email and rejects real Pix creation.

## User stories

### US-165 — Preserve the checkout payer identity

As a buyer, I want the payer email supplied at checkout to reach the payment
provider unchanged, so that my Pix payment can be created successfully.

#### AC-363 — Payment receives the checkout payer email

- **Dado** an authenticated checkout whose owner identifier differs from its payer email
- **Quando** Transaction publishes the order-received integration event for payment
- **Então** the payload carries the checkout payer email unchanged and never substitutes the owner identifier

## Out of scope

- Changing OAuth ownership or authorization rules.
- Changing Mercado Pago credentials, request semantics, or provider selection.
- Changing public GraphQL input fields or WooCommerce session behavior.

## Suposições

None.

## Perguntas em aberto

None.
