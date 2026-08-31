# Spec: Milestone 5 — GraphQL subscriptions over SSE

> feature: milestone-5-subscription-sse
> status: pronta

## Context

Milestone 4 drives Card and Pix checkouts to terminal workflow states, but buyers
can observe progress only by polling. This feature exposes the accepted hybrid
GraphQL edge from ADR 001: the gateway authenticates a `graphql-sse` request and
delegates the subscription to Commerce, while normal federated queries and
mutations remain on Apollo Gateway. Streams are namespaced by the authenticated
subject and `operationKey`, so they may open before checkout without leaking
another buyer's existence or events.

## Stories

### US-031 — Buyer follows checkout progress from before creation

As a buyer, I want to subscribe before starting checkout so that I receive each
subsequent workflow state through the terminal result without polling.

#### AC-053 — A pre-mutation Card stream reaches completion

- **Dado** an authenticated Card buyer subscribed to a new operation key before checkout
- **Quando** checkout and its payment and inventory events complete successfully
- **Então** the SSE stream receives ordered workflow events through `COMPLETED`, and the terminal event equals the workflow returned by the read model

#### AC-054 — A pre-mutation Pix stream returns its stable code

- **Dado** an authenticated Pix buyer subscribed to a new operation key before checkout
- **Quando** payment generates the Pix instruction
- **Então** the SSE stream terminates at `PIX_GENERATED` with the same Pix code and workflow state returned by the read model

### US-032 — Buyer receives only their own operation events

As a buyer, I want subscription authorization and isolation so that another
authenticated user cannot discover or receive my checkout progress.

#### AC-055 — Authentication is required before opening the stream

- **Dado** a missing, invalid, expired, or incorrectly scoped access token
- **Quando** a client attempts to subscribe at the gateway SSE endpoint
- **Então** the stream is rejected before a subscription or broker consumer is allocated

#### AC-056 — Operation keys are isolated by authenticated subject

- **Dado** two authenticated buyers using the same operation key
- **Quando** one buyer checks out and both clients keep subscriptions open
- **Então** only the checkout owner receives its events, while the other stream reveals neither order existence nor state

### US-033 — Platform operates a bounded GraphQL SSE transport

As the operations owner, I want the subscription transport to release resources
and handle slow or idle clients predictably so that long-lived streams remain
safe to operate.

#### AC-057 — The edge uses GraphQL SSE through both segments

- **Dado** a valid `orderEvents` subscription through the federated edge
- **Quando** Commerce publishes an order transition
- **Então** the client receives a `text/event-stream` GraphQL SSE response delegated through the gateway without WebSocket or multipart substitution

#### AC-058 — Cancellation, timeout, heartbeat, and backpressure are bounded

- **Dado** active, idle, cancelled, and slow subscription clients
- **Quando** their configured lifecycle limits are reached
- **Então** cancellation releases listeners and broker resources, idle streams emit heartbeat then time out, and a slow client is bounded rather than accumulating events indefinitely

#### AC-059 — Milestone acceptance covers both terminal journeys

- **Dado** the gateway, Commerce, RabbitMQ, and the Milestone 4 checkout participants
- **Quando** the Milestone 5 Nx acceptance target runs
- **Então** subscribe-before-mutate journeys pass for Card and Pix, including ownership isolation and equality between terminal stream and read-model states

## Out of scope

- Replay for clients that subscribe after events were published.
- WebSocket and Apollo Router multipart subscription transports.
- A general-purpose event streaming platform, persisted subscription offsets, or
  cross-device notification history.
- Pix confirmation, expiration, and inventory reservation after payment.
- Horizontal gateway or Commerce scaling beyond the RabbitMQ-backed fan-out
  contract proven by this milestone.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-017 | The hybrid GraphQL/SSE edge is the implementation path. | confirmada | ADR 001 and the Milestone 0 PoC prove `graphql-sse` client → gateway → Federation v2 subgraph using `text/event-stream`. |
| ASM-018 | Pre-creation ownership is represented by the composite `(subject, operationKey)` namespace. | confirmada | PRD 04 requires pre-mutation subscription and filtering by both values; an unowned key therefore remains an indistinguishable waiting stream rather than an existence lookup. |
| ASM-019 | Live delivery does not require replay. | confirmada | PRD 04 and the roadmap explicitly make late replay optional; the acceptance journey opens the stream before mutation. |
| ASM-020 | RabbitMQ carries committed workflow transition notifications to the live Commerce subscription source. | confirmada | ADR 001 requires replacing the PoC's in-memory source with the project broker, and Milestone 4 already establishes RabbitMQ topology and confirmed publication. |
| ASM-021 | `COMPLETED`, `CANCELLED`, and `PIX_GENERATED` close a stream after delivery. | confirmada | These are the terminal Card success, compensated Card, and Pix states currently defined by the saga. |

## Perguntas em aberto

None.
