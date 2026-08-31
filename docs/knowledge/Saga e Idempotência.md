---
tags: [saga, rabbitmq, idempotency, outbox, inbox]
updated: 2026-08-25
---

# Saga and Idempotency

Return to [[Mapa do Projeto]]. Produces events for [[Subscriptions SSE]].

- The client key identifies the operation before `orderId` exists.
- A unique constraint + command hash overcome concurrency and divergent payloads.
- Outbox makes the commit and the intent to publish atomic.
- Inbox makes consumers tolerant of at-least-once delivery.
- Inventory-failure compensation requests a refund; it does not erase history.
- Order state converges and never regresses due to duplicate/delayed events.

Details: [Commerce PRD](../prds/04-commerce-saga-e-realtime.md).
