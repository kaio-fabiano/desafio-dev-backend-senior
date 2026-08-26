# PRD 04 — Cart, orders, saga, and real time

## Expected outcome

The user creates an idempotent order from their own cart, follows its progress
through a subscription opened before the mutation, and observes the same final
state in the subscription, the `me` query, and Apollo MCP.

## Aggregates and invariants

### Cart

- belongs to the authenticated `subject`;
- does not accept `userId` from the client;
- an item references `Product` by federated ID and stores a valid quantity;
- the final price is revalidated when the order is created.

### Commercial order and OrderWorkflow

- the commercial order, its items, prices, customer, and authoritative status
  live in WooCommerce and are exposed through existing WooGraphQL capabilities;
- the custom service stores unique `(userId, operationKey)`, `wooOrderId`, saga
  state, and correlation metadata, without maintaining a second complete copy;
- the workflow advances only through allowed transitions and reconciles its
  state with the WooCommerce order;
- `pixCode` is required only in the `PIX_GENERATED` state;
- a replay response is equivalent to the original.

## End-to-end idempotency

On the first mutation:

1. insert `operation` with a unique `(user_id, operation_key)` constraint;
2. store a canonical command hash;
3. create/reuse the WooCommerce order with an idempotency reference;
4. persist `wooOrderId`, workflow state, and local outbox;
5. return the `Order` entity composed by the supergraph.

The exact checkout API and the failure-recovery mechanism between steps 3 and 4
will be established in the PoC. A `PENDING_WOO` operation must be reconcilable;
there is no atomic transaction between PostgreSQL and WordPress.

On retry:

- the same hash returns the previous order;
- a different hash with the same key returns a conflict;
- concurrency is resolved by the constraint, not by “check then insert”;
- the processor uses the payment ID/operation key as its idempotency key;
- consumers use an inbox keyed by `eventId`.

## Proposed events

Common envelope:

```json
{
  "eventId": "uuid",
  "eventType": "order.created.v1",
  "occurredAt": "RFC3339",
  "correlationId": "operation-key",
  "causationId": "uuid-or-null",
  "traceparent": "optional",
  "payload": {}
}
```

Card flow:

```text
order.created.v1
  -> payment.requested.v1
  -> payment.approved.v1
  -> stock.reservation-requested.v1
  -> stock.reserved.v1
  -> order.completed.v1

stock.reservation-failed.v1
  -> payment.refund-requested.v1
  -> payment.refunded.v1
  -> order.cancelled.v1
```

Minimum Pix flow:

```text
order.created.v1
  -> payment.pix-requested.v1
  -> payment.pix-generated.v1 (with pixCode)
  -> order.pix-generated.v1
```

The relationship between Pix and stock reservation is unresolved: reserving when
the code is generated can hold stock without payment; waiting for confirmation
goes beyond the final state required in the E2E. Record the decision before
coding the Pix saga.

## RabbitMQ

Initial proposal:

- durable topic exchange `marketplace.events.v1`;
- durable queues per consumer and quorum queues where data safety matters;
- publisher confirms and `mandatory` publishing;
- manual acknowledgements only after the local transaction;
- retry with queue/TTL backoff or delayed-message only if the dependency is
  accepted; a finite limit and inspectable DLQ;
- calibrated prefetch and idempotency-protected concurrent processing;
- broker policies for DLX, avoiding divergent arguments in code.

RabbitMQ delivers at least once when confirms/acks are used; duplicates are
expected and are part of the consumer contract.

## Reliable publishing

- The outbox publisher reads batches with a cooperative lock (`SKIP LOCKED` or equivalent).
- An event is marked as sent only after publisher confirmation.
- Resending after a timeout is allowed and deduplicated at the destination.
- The consumer effect and inbox are written in the same transaction.
- A terminal failure includes a safe reason and goes to the DLQ without secrets/PII.

## `graphql-sse` subscription

Logical contract:

```graphql
type Subscription {
  orderEvents(operationKey: ID!): OrderEvent!
}
```

- authentication occurs before reserving/opening the stream;
- a subscription created before the order remains open;
- events are filtered by `(subject, operationKey)`;
- another user's key does not reveal whether an order exists;
- client cancellation releases resources;
- heartbeat, timeout, and backpressure are configured and tested;
- the final event contains sufficient state for comparison with `me`;
- late replay is a differentiator; an initial snapshot can be added later.

Do not confuse GraphQL SSE `text/event-stream` with Apollo Router multipart HTTP.
The gateway proof of concept is the gate for the first milestone.

## Tests

- the same key, sequentially and concurrently, creates one order/one charge;
- the same key with a different payload fails;
- a duplicate message does not repeat its effect;
- a crash after the effect and before the ack is recovered;
- stock failure triggers a refund and cancellation;
- a subscription opened before the mutation receives events through the terminal state;
- a user cannot subscribe to another user's key;
- the final status is the same in the stream and query;
- card ends approved/completed; Pix ends with a code.

## Sources

- [RabbitMQ Reliability](https://www.rabbitmq.com/docs/reliability)
- [RabbitMQ Quorum Queues](https://www.rabbitmq.com/docs/quorum-queues)
- [RabbitMQ Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx)
- [graphql-sse](https://github.com/enisdenjo/graphql-sse)
- [GraphQL over SSE Protocol](https://github.com/enisdenjo/graphql-sse/blob/master/PROTOCOL.md)
