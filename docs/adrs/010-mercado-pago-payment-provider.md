# ADR 010: Mercado Pago payment provider

- Status: accepted
- Date: 2026-09-02
- Decision owner: platform architecture

## Context

The deterministic payment adapter proves choreography but cannot authorize a
Card, create a Pix payload, or confirm a refund. Production also needs a clear
trust boundary: this platform must not collect raw Card data, trust webhook
payload state, or turn a transport timeout into a second financial operation.

## Decision

Payment Federation integrates Mercado Pago's transparent Payments API behind
the existing `PaymentProvider` outbound port, using the official Java SDK.
Provider transport, credentials, status vocabulary, and signature validation
remain in Payment adapters and configuration. Domain and application packages
do not import Mercado Pago.

The browser or another PCI-appropriate client tokenizes Card data with Mercado
Pago.js or Bricks. The backend accepts only that short-lived provider token,
the payer email, and the provider payment-method identifier. PAN, card security
codes, and raw Card payloads are prohibited across GraphQL, RabbitMQ,
persistence, and logs.

Every create or refund call uses the workflow operation key as Mercado Pago's
`X-Idempotency-Key`. The provider reference returned by Mercado Pago is the
only reference used for later lookup and refund. A timeout does not authorize a
new key: redelivery repeats the original operation key, allowing Mercado Pago's
idempotency record to reconcile the ambiguous response.

Webhook ingress validates `x-signature`, `x-request-id`, the resource id, the
configured secret, and a bounded signature age before invoking application
code. The notification body is not a financial authority. Payment Federation
fetches the payment with server credentials, correlates the returned reference,
and then applies only a monotonic transition. A database inbox primary key
deduplicates the provider request id; row locking, the state update, and the
outbox write share one transaction.

Mercado Pago mode validates the access token, webhook secret, official API
endpoint, and bounded timeouts during startup. The deterministic provider is
available only in explicit `local` or `test` profiles. A production-like
runtime therefore fails closed instead of silently moving no money.

## Operational boundary

The credential-free contract suite is the normal CI gate. Real Card, Pix,
webhook, and refund checks are opt-in because their credentials and public
callback endpoint are external secrets. The procedure and sanitization rules
are defined in the [Mercado Pago sandbox runbook](../runbooks/mercado-pago-sandbox.md).
Pix code generation is not settlement and does not reserve inventory.

The local suite executes the adapter against the SDK request and response
types while replacing only the remote client, and exercises webhook rejection,
notification correlation, repeated operation keys, and refund lookup. Package
dependency tests enforce the architectural boundary separately. Source-text
assertions are not accepted as substitutes for these behavioral checks.

## Alternatives considered

- Keep the deterministic adapter in production: rejected because it reports
  workflow behavior without processing money.
- Send raw Card fields through the backend: rejected because it expands PCI
  scope without adding a required capability.
- Trust webhook status fields: rejected because notifications are untrusted
  transport hints and may be forged, duplicated, delayed, or reordered.
- Retry with a new idempotency key after timeout: rejected because it can create
  a duplicate charge or refund.
- Add a generic multi-provider framework: rejected because one outbound port
  already isolates the selected vendor and no second provider is required.

## Consequences and replacement condition

Provider availability and rate limits can delay convergence, so operations must
retain the original operation key and provider reference during recovery. The
application never fabricates success while Mercado Pago is unavailable.

Replacing Mercado Pago requires a new ADR and contract suite proving equivalent
tokenization, idempotency, authoritative lookup, webhook authentication,
replay safety, ambiguity recovery, and refund semantics. The deterministic
adapter remains a local test tool, not a rollback option for production.
