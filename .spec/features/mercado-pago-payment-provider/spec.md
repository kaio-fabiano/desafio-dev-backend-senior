# Spec: Mercado Pago payment provider

> feature: mercado-pago-payment-provider
> status: auditada

## Contexto

The Payment Federation currently proves choreography and idempotency with a
deterministic adapter, but it does not move money. Production needs a real
Brazilian processor without allowing provider transport, credentials, or
webhook semantics into the financial domain. Mercado Pago is selected because
one official integration supports Card, Pix, Java, idempotent requests, signed
webhooks, refunds, and test credentials.

The implementation uses Mercado Pago's transparent Payments API. Card data is
tokenized by Mercado Pago client-side components and only the short-lived token
crosses the application boundary; raw card data never enters this platform.

## Histórias

### US-079 — Create a real Card or Pix payment

As a buyer, I want checkout to create one real provider payment, so that Card
authorization or the Pix code reflects the processor rather than a placeholder.

#### AC-160 — Provider creation is idempotent

- **Dado** a valid Card token or Pix payer input and a workflow operation key
- **Quando** Payment Federation submits the same logical request more than once
- **Então** every request uses the same provider idempotency key, stores one provider reference, and never creates a second charge

#### AC-161 — Card data stays outside the platform

- **Dado** a buyer selecting Card at checkout
- **Quando** the payment command crosses GraphQL, RabbitMQ, logs, persistence, and the provider adapter
- **Então** only a short-lived Mercado Pago token is accepted and no PAN, security code, or raw card payload is handled or retained

#### AC-162 — Pix data comes from Mercado Pago

- **Dado** a valid Pix payment request in BRL
- **Quando** Mercado Pago accepts the request
- **Então** Payment Federation persists and publishes the provider payment reference and provider-generated Pix copy-and-paste code

### US-080 — Converge asynchronous provider state

As an operator, I want signed provider notifications to converge payment state,
so that delayed, duplicated, or reordered deliveries cannot corrupt the saga.

#### AC-163 — Webhooks are authenticated and replay-safe

- **Dado** a Mercado Pago payment notification
- **Quando** the public webhook endpoint receives it
- **Então** an invalid signature is rejected and repeated valid notifications produce at most one financial transition and one outbox event

#### AC-164 — Authoritative state is fetched before transition

- **Dado** a valid notification containing a provider resource identifier
- **Quando** Payment Federation processes the notification
- **Então** it retrieves the payment with server credentials, correlates it through stored metadata/reference, and applies only a valid monotonic domain transition

### US-081 — Recover ambiguous requests and refunds

As an operator, I want provider operations to be safely recoverable, so that a
network timeout cannot become an unknown duplicate charge or refund.

#### AC-165 — Ambiguous creation is reconciled

- **Dado** a timeout or retriable provider failure after submitting a payment
- **Quando** the command is redelivered or reconciled
- **Então** the same idempotency key is reused and the stored provider result is recovered without issuing a distinct payment

#### AC-166 — Refunds use the original provider reference

- **Dado** an approved Card payment with a persisted Mercado Pago reference
- **Quando** the same refund command is delivered repeatedly
- **Então** one idempotent provider refund is requested and the local payment becomes refunded only after authoritative confirmation

### US-082 — Operate real and local payment modes safely

As a maintainer, I want explicit validated configuration and executable
provider contracts, so that production cannot silently run the placeholder.

#### AC-167 — Runtime mode fails closed

- **Dado** a production-like runtime configured for Mercado Pago
- **Quando** credentials, webhook secret, timeout, or required endpoint configuration is missing or invalid
- **Então** application startup fails without logging secrets, while the deterministic provider remains explicitly limited to test and local profiles

#### AC-168 — Provider behavior has repeatable evidence

- **Dado** the provider adapter, webhook ingress, persistence, and event contracts
- **Quando** the payment quality gates run without external credentials
- **Então** deterministic contract tests prove Card, Pix, idempotency, invalid signatures, webhook replay, timeout recovery, and refund behavior, and an opt-in sandbox runbook describes the credentialed verification

### US-083 — Keep bounded contexts structurally explicit

As a maintainer, I want Payment and Inventory organized consistently by bounded
context and clean architecture layer, so that dependency direction and domain
ownership remain evident as the Java runtime evolves.

#### AC-169 — Java package boundaries enforce clean architecture

- **Dado** Payment and Inventory sharing one Spring Boot deployment
- **Quando** their production packages and imports are inspected
- **Então** each bounded context has explicit domain, application, adapter, and configuration boundaries, domain code imports no framework or adapter, application code depends only on domain and declared ports, and Spring composes dependencies only at the outer boundary

## Fora de escopo

- Collecting or rendering card fields in a new frontend application.
- Storing raw card data or expanding PCI scope beyond provider tokenization.
- Recurring payments, installments, split payments, chargebacks, and disputes.
- Automatically deploying production credentials or billable infrastructure.
- Treating Pix code generation as settlement or reserving inventory for unpaid Pix.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-058 | The challenge requires Card approval and Pix code generation, but not a production frontend; provider token creation is therefore an external client responsibility represented by a test token in contract tests. | confirmada | The README defines backend behavior and no frontend deployable; raw card handling remains prohibited. |
| ASM-059 | Mercado Pago test credentials will be supplied outside the repository when the optional sandbox verification is executed. | confirmada | Secrets are deployment inputs and must never be committed; credential-free contract tests remain mandatory. |
| ASM-060 | Pix remains terminal at code generation for challenge compatibility and does not emit payment approval or trigger inventory reservation until a future settlement feature is specified. | confirmada | This preserves README section 10.4 and the existing saga invariant. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-008 | Which provider should close production gap G-001? | respondida | Mercado Pago, selected for the simplest Brazil-focused Card and Pix integration with an official Java SDK, mandatory idempotency, signed webhooks, refunds, and test credentials. |
