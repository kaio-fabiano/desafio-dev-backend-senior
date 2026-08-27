# Design: Milestone 5 — GraphQL subscriptions over SSE

## Smallest live-delivery slice

The accepted ADR 001 edge remains split by transport. Apollo Gateway handles
federated queries and mutations. A colocated `graphql-sse` handler authenticates
the same bearer token, then delegates `Subscription.orderEvents` to Commerce.
This preserves one public GraphQL boundary without pretending Apollo multipart
is SSE or introducing WebSocket infrastructure.

## Ownership before order creation

The stream identity is `(subject, operationKey)`, not `operationKey` alone. The
gateway derives `subject` from the verified token and never accepts it from
GraphQL variables or headers supplied by the client. Commerce uses the same
composite namespace when publishing and filtering. Consequently, a stream may
wait before a workflow exists and another buyer using the same visible key sees
only their own empty namespace.

## Committed event path

```text
Commerce transaction commits workflow transition
  -> transition publisher routes a minimal live event through RabbitMQ
  -> Commerce subscription broker receives and filters by subject + operationKey
  -> Commerce graphql-sse endpoint
  -> gateway graphql-sse delegation
  -> client
```

Duplicate or ignored saga deliveries do not create live events. A transition is
published only after its database transaction commits. RabbitMQ supplies the
cross-process boundary already used by the saga; no replay database or second
streaming platform is added.

## Stream lifecycle

Each subscription owns a bounded async iterator. Heartbeats keep healthy idle
connections observable, an idle deadline closes abandoned pre-mutation streams,
and a finite queue terminates slow consumers instead of growing memory without
limit. Client abort propagates gateway → Commerce and unregisters the listener.
`COMPLETED`, `CANCELLED`, and `PIX_GENERATED` are delivered before completion.

## Verification

Unit tests cover composite filtering, ordered bounded queues, terminal closure,
heartbeat, timeout, and cancellation. Transport tests assert authentication is
performed before allocation and both network segments use `text/event-stream`.
The acceptance target opens streams first, performs Card and Pix checkout
journeys, then compares each terminal event with the federated read model.
