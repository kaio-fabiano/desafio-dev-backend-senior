# Design: Mercado Pago payment provider

## Decision

Integrate Mercado Pago's transparent Payments API behind the existing
`PaymentProvider` outbound port. Use the official Java SDK for payment creation,
lookup, refund, and webhook signature validation. The deterministic adapter is
retained only under explicit local/test configuration.

## Boundaries

- Order Workflow owns checkout idempotency and publishes a payment command.
- Payment owns financial state, provider references, notification deduplication,
  and financial outbox events.
- Mercado Pago owns execution, Card authorization, Pix generation, and the
  authoritative provider status.
- WooCommerce remains the commercial order authority and is updated only from
  confirmed Payment domain events.
- The client uses Mercado Pago.js or Bricks to tokenize Card data. This backend
  receives a short-lived token, never PAN or card verification data.

## Package architecture

The deployable is organized bounded-context first under a neutral runtime root:

```text
dev.desafio.transaction
├── PaymentFederationApplication
├── payment
│   ├── domain
│   ├── application
│   ├── adapter
│   └── configuration
└── inventory
    ├── domain
    ├── application
    ├── adapter
    └── configuration
```

`domain` is framework-free. `application` owns use cases and inbound/outbound
ports and imports only its domain. `adapter` implements ports for GraphQL,
RabbitMQ, PostgreSQL, Mercado Pago, and WooCommerce. `configuration` is the
Spring composition root for that bounded context. Payment and Inventory do not
import one another; versioned events are their integration boundary. Empty
layers are not created merely to complete the tree.

## Lifecycle

1. Order Workflow publishes `payment.requested` with the operation key, amount,
   method, and minimum provider input.
2. Payment durably claims the incoming event and submits the operation using the
   operation key as `X-Idempotency-Key`.
3. The provider reference and initial state are persisted. Pix creation may
   immediately publish `payment.pix-generated`; Card remains pending unless the
   authoritative response is approved.
4. Mercado Pago calls the public webhook. The adapter validates `x-signature`
   and `x-request-id`, then retrieves the payment rather than trusting webhook
   fields.
5. The application correlates the provider reference, rejects conflicting or
   regressive transitions, deduplicates delivery, and commits the transition
   and outbox event atomically.
6. Timeout recovery resubmits with the same idempotency key or retrieves the
   recorded provider resource. It never invents a successful state.

## Persistence and concurrency

Provider reference, status, request fingerprint, and timestamps live with the
Payment aggregate. A notification inbox uses provider identity as a unique key.
Row locking and database constraints serialize competing RabbitMQ and webhook
transitions; the same transaction writes the resulting outbox record.

An external API call cannot participate in the database transaction. Provider
idempotency closes the duplicate-charge window; local persistence plus
authoritative lookup closes the ambiguous-response window. Network calls use
bounded timeouts and retry only with the same idempotency key.

## Configuration and security

Typed `@ConfigurationProperties` validates provider mode, access token, webhook
secret, endpoints, and timeouts. Mercado Pago mode fails at startup when values
are absent. Logs contain correlation IDs, provider request IDs, and sanitized
status only—never credentials, payer documents, Card tokens, or webhook bodies.

## Verification strategy

Credential-free tests control the HTTP/SDK boundary and prove serialized
requests, idempotency, response mapping, timeouts, signatures, authoritative
retrieval, replay safety, and refunds. The normal E2E remains hermetic. A
separate opt-in sandbox runbook proves the real API with external credentials.

## Alternatives rejected

- Synthetic immediate success does not process a real payment.
- Raw Card fields through GraphQL/RabbitMQ unnecessarily expand PCI scope.
- A WooCommerce payment plugin hides required financial behavior from the
  separate Payment runtime.
- Direct SDK calls from the application handler couple policy to the vendor.
- A generic multi-provider framework is unnecessary; the existing port suffices.
