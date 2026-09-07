# Bounded-context map

The strict DDD contract applies to these ownership boundaries:

| Context | Owns | Does not own |
| --- | --- | --- |
| Identity | authentication, OAuth, registration, sessions, identity graph fields | commerce or payment state |
| Commercial | catalog, cart, checkout, orders, customers, inventory | identity sessions or payment authorization |
| Workflow | checkout idempotency, delivery, inbox/outbox mechanics | commercial order truth or payment invariants |
| Payment | authorization, Pix, compensation, idempotency, payment views | WooCommerce storage or identity records |
| Edge | authenticated composition and transport | business persistence and aggregates |

Dependencies point inward within a context. Across contexts, only versioned
contracts and federated references cross the boundary. The owning context
defines the use case, aggregate or explicit absence, invariants, consistency
boundary, and ports for every change.

```text
composition -> adapters -> application -> domain
                         -> contracts
```

The canonical structural and testing rules are in
[`strict-nestjs-ddd.md`](../standards/strict-nestjs-ddd.md).
