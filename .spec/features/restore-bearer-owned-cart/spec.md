# Spec: Restore bearer-owned cart

> feature: restore-bearer-owned-cart
> status: pronta

## Context

The Gateway currently treats WooCommerce cart-session headers as client state,
so two requests carrying the same valid OAuth bearer can resolve different
carts. The public client must use only its platform bearer while WordPress
authentication remains an internal federation concern.

## Stories

### US-161 — Keep one client credential for the cart

As an authenticated buyer, I want my cart to follow my platform session so that
I do not need to manage WooCommerce credentials.

#### AC-357 — The same bearer resolves the same cart

- **Dado** an authenticated buyer sends only a valid OAuth bearer
- **Quando** the buyer adds a product and reads the cart in a later request
- **Então** the cart contains the added product without client-supplied WooCommerce session headers

#### AC-358 — Carts remain isolated by authenticated buyer

- **Dado** two authenticated buyers send only their respective OAuth bearers
- **Quando** one buyer adds a product and both buyers read their carts
- **Então** only the buyer who added the product sees it

## Out of scope

- Changing the public GraphQL cart schema.
- Reintroducing process-local subject-to-session state.
- Exposing WordPress authentication credentials to clients.

## Suposições

None. The user explicitly confirmed that `Authorization` is the only client
credential for the session.

## Perguntas em aberto

None.
