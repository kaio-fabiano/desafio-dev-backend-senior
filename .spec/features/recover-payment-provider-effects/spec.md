# Spec: Recover payment provider effects

> feature: recover-payment-provider-effects
> status: rascunho

## Context

The Payment Axon event handler currently schedules provider work after the
processing unit commits and discards the returned future. Axon can therefore
advance its processor token before the provider outcome command completes.
Additionally, an existing incomplete ledger claim switches recovery to a
lookup-only path, which can strand a payment or incorrectly treat an approved
payment as a completed refund.

## User stories

### US-138 — Recover payment provider effects safely

As an operator, I want interrupted payment and refund effects to remain
retryable, so that a process failure cannot silently lose or misclassify a
financial operation.

#### AC-296 — Axon observes effect completion

- **Dado** a payment or refund provider effect whose outcome command is still pending or fails
- **Quando** the Axon event handler processes the corresponding domain event
- **Então** the handler remains incomplete or fails with that outcome instead of completing early

#### AC-297 — Incomplete claims remain retryable

- **Dado** a persisted provider-effect claim without a completed result
- **Quando** Axon redelivers the same payment or refund event
- **Então** the provider operation is retried with the same operation key and only its matching result completes the ledger

## Out of scope

- Removing the shared RabbitMQ inbox or integration-event outbox.
- Replacing JDBC persistence or introducing an ORM.
- Changing public GraphQL, AMQP, or provider contracts.

## Suposições

None.

## Perguntas em aberto

None.
