# Spec: Propagate checkout card credentials

> feature: propagate-checkout-card-credentials
> status: implementada

## Contexto

`startCheckout` validates and hashes the Mercado Pago short-lived Card token
and payment method identifier, but `CheckoutService` drops both when it creates
`StartTransaction`. The asynchronous choreography later fabricates
`providerCredentialReference` from `paymentId` and hard-codes
`paymentMethodId` as `card`, so the deterministic provider works while a real
Mercado Pago Card authorization receives invalid inputs. The flow must preserve
the opaque, short-lived token and the selected method identifier without ever
accepting PAN, CVV, or another raw Card field.

## Histórias

### US-141 — Authorize the Card selected at checkout

As a buyer, I want the Card token created for my checkout to reach Mercado
Pago unchanged, so that the asynchronous payment authorizes the Card I
actually selected.

#### AC-306 — Checkout credentials reach the payment request unchanged

- **Dado** a Card checkout with a short-lived Mercado Pago provider token and
  a concrete payment method identifier
- **Quando** the checkout progresses through Transaction and Inventory to the
  Payment request
- **Então** the Payment provider command receives the same token and payment
  method identifier, never a value derived from `paymentId` or the hard-coded
  value `card`

## Fora de escopo

- Accepting, storing, or publishing PAN, CVV, expiry, or other raw Card data.
- Adding a frontend Card form or changing Mercado Pago tokenization.
- Refactoring unrelated Transaction, Inventory, or Payment behavior.

## Suposições

None. The existing Mercado Pago provider specification already confirms that
the client creates the short-lived token and that this token may cross the
GraphQL, RabbitMQ, persistence, and provider boundaries.

## Perguntas em aberto

None.
