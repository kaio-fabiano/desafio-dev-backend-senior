# ADR 009: Payment provider port and co-located Inventory participant

- Status: accepted
- Date: 2026-09-01
- Decision owner: platform architecture

## Context

Payment owns financial invariants. Inventory reacts to the order workflow but
uses WooCommerce as stock authority. A real payment processor will be selected
later; binding application code to one vendor now would mix policy, transport,
credentials, webhook semantics, and provider-specific failure modes.

The challenge requires RabbitMQ choreography, but it does not require a separate
Inventory deployment. A process boundary would add operational cost without
creating an independent scaling or release requirement today.

## Decision

Payment application code depends on a `PaymentProvider` outbound port. The
current deterministic adapter is explicitly a development placeholder, not a
real processor. A future provider adapter must use the workflow operation key
as the provider idempotency key and persist the external reference before its
result is considered durable.

Inventory remains a separate application participant inside the Java runtime.
It has its own queue, listener, service, idempotency records, outbox events, and
WooCommerce stock port. Payment and Inventory do not call each other directly;
their only cross-participant interaction is through versioned RabbitMQ events.

## Alternatives considered

- Import a payment SDK into `PaymentHandler`: rejected because vendor concerns
  would enter application policy and make provider replacement unsafe.
- Put Inventory inside the Payment aggregate: rejected because stock and money
  have different invariants and authorities.
- Deploy Inventory separately now: rejected because isolation inside the Java
  runtime satisfies the boundary without another idle container.
- Let Order Workflow call a payment API synchronously: rejected because it
  violates the required choreography and weakens redelivery guarantees.

## Real-provider implementation gate

The provider-selection feature must document sandbox availability, supported
payment methods, webhook signature verification, credential storage, timeout
and ambiguity reconciliation, refunds, provider idempotency guarantees, PCI and
LGPD impact, rate limits, and operational cost. It must persist provider
references and prove webhook replay safety before replacing the placeholder.

## Consequences and removal condition

The seam makes vendor selection reversible while keeping Payment focused. The
placeholder cannot be represented as production readiness. Inventory may move
to another deployment only when independent scaling, availability, ownership,
or release cadence is demonstrated. The provider port may be removed only if
the financial aggregate itself is retired in favor of a platform that owns all
of its invariants and lifecycle.
