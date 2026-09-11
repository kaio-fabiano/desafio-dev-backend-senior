# Spec: Align milestone 7 checkout contract

> feature: align-milestone-7-checkout-contract
> status: rascunho

## Contexto

The Java Payment Federation now returns a durable `CheckoutOperation` from
`startCheckout`, but the Gateway static order-workflow contract and Milestone 7
journey still expect the retired `Order` response shape. The composed Gateway
therefore sends fields that do not exist on the runtime type and rejects the
checkout before the acceptance journey can continue.

## Histórias

### US-158 — Exercise the refactored checkout contract end to end

As a release operator, I want the Gateway contract and acceptance journey to
use the Java checkout-operation response so that the sandbox is deployed only
after the refactored topology completes its checkout flows.

#### AC-352 — Gateway checkout composition matches the Java runtime

- **Dado** the Java `startCheckout` mutation returns a durable
  `CheckoutOperation` and completed order data is resolved separately
- **Quando** the Gateway composes the static contract and the Milestone 7
  journey performs checkout and retries it
- **Então** the operation fields are accepted by the Java subgraph, retries
  preserve the operation and order identifiers, and the final federated order
  exposes the expected workflow state

#### AC-353 — Checkout reads are registered in the production application

- **Dado** the production Payment Federation starts with its Transaction read
  repository
- **Quando** an authenticated buyer reads a checkout operation
- **Então** Axon dispatches the query to the checkout-operation handler and
  returns only that buyer's operation instead of reporting that no handler is
  available

#### AC-354 — Native WooCommerce checkout preserves the linked buyer

- **Dado** the Better Auth subject is linked to a WordPress customer through
  the `better_auth_user_id` metadata
- **Quando** Transaction creates an order from that buyer's cart
- **Então** it authenticates the native WooCommerce checkout as the linked
  customer, the order stores that customer instead of guest `0`, and the same
  buyer can read the completed federated order

## Limites DDD

- **Bounded context:** Edge/shared integration-contract boundary and Java
  Transaction checkout integration.
- **Use case:** compose and verify checkout across Gateway and Transaction,
  including buyer-owned WooCommerce order creation and checkout reads.
- **Aggregate:** none; this task aligns transport contracts and release proof.
- **Invariants:** `startCheckout` returns `CheckoutOperation`; an idempotent
  retry preserves `id` and `orderId`; checkout queries preserve subject
  isolation; native WooCommerce checkout records the linked buyer rather than
  a guest; final order state is read through the federated `Order` entity.
- **Consistency boundary:** one checkout operation and its native WooCommerce
  order, synchronized through the existing terminal SSE event.
- **Affected ports:** Gateway static subgraph SDL, Milestone 7 GraphQL
  acceptance client, Transaction read repository, Axon query bus, and the
  WooCommerce GraphQL order port.

## Fora de escopo

- Changing Java checkout domain behavior or persistence schema.
- Reintroducing the retired `Order` mutation response.
- Adding a new synchronization or polling mechanism.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-129 | The Java runtime SDL is the authoritative checkout response contract. | confirmada | `payment.graphqls` and `OrderWorkflowGraphQlCompatibilityTest` both expose `CheckoutOperation` with `id`, `operationKey`, `status`, `orderId`, `paymentId`, and `errorReason`. |
| ASM-130 | The existing WPGraphQL Headless Login site-token provider can authenticate a linked buyer without storing or replaying the buyer's password. | confirmada | A live local probe authenticated the Better Auth subject through `SITETOKEN` and resolved WordPress customer database ID 5. |

## Perguntas em aberto

Nenhuma.
