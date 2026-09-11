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

## Limites DDD

- **Bounded context:** Edge and shared integration-contract boundary.
- **Use case:** compose and verify the checkout mutation across Gateway and the
  Java Transaction owner.
- **Aggregate:** none; this task aligns transport contracts and release proof.
- **Invariants:** `startCheckout` returns `CheckoutOperation`; an idempotent
  retry preserves `id` and `orderId`; final order state is read through the
  federated `Order` entity.
- **Consistency boundary:** GraphQL request plus the existing terminal SSE
  event; no new polling or transaction boundary.
- **Affected ports:** Gateway static subgraph SDL and the Milestone 7 GraphQL
  acceptance client.

## Fora de escopo

- Changing Java checkout domain behavior or persistence.
- Reintroducing the retired `Order` mutation response.
- Adding a new synchronization or polling mechanism.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-129 | The Java runtime SDL is the authoritative checkout response contract. | confirmada | `payment.graphqls` and `OrderWorkflowGraphQlCompatibilityTest` both expose `CheckoutOperation` with `id`, `operationKey`, `status`, `orderId`, `paymentId`, and `errorReason`. |

## Perguntas em aberto

Nenhuma.
