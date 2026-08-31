# Spec: Challenge compliance and delivery closure

> feature: delivery-closure
> status: auditada

## Context

The mechanical project audit is green, but it audits the repository's derived
specifications rather than the immutable challenge contract. A direct audit of
the challenge README found that the current five-application topology removed
mandatory RabbitMQ choreography, inventory reaction, compensation, and their
real E2E proof. The current journey invokes checkout and payment synchronously,
and tests explicitly reject RabbitMQ. This feature restores full challenge
compliance while keeping payment and inventory reactions inside one Java
Payment Federation runtime, then closes documentation and optional
observability honestly.

## User stories

### US-055 — Trust the challenge compliance record

As an evaluator, I want every mandatory challenge requirement mapped to runtime
evidence, so that green project-local gates cannot hide a contract regression.

#### AC-109 — Compliance evidence uses the challenge as source of truth

- **Dado** the mandatory objectives, functional requirements, non-functional requirements, and acceptance criteria in the challenge README
- **Quando** the final compliance matrix is inspected
- **Então** every requirement is classified as proven, partially proven, not proven, or optional with a direct link to executable evidence and no nonexistent task references

### US-056 — Execute the mandatory asynchronous order lifecycle

As a buyer, I want checkout to trigger payment and inventory through durable
events, so that retries and failures preserve one convergent order outcome.

#### AC-110 — RabbitMQ choreography is active

- **Dado** a checkout command with a client-generated operation key
- **Quando** the order is created
- **Então** the active runtime publishes and consumes the documented RabbitMQ event topology without the client directly invoking payment or inventory

#### AC-111 — Payment delivery is reliable and idempotent

- **Dado** duplicate and concurrent payment deliveries plus a process restart
- **Quando** the separate Java payment processor handles them
- **Então** inbox and outbox persistence, publisher confirms, explicit acknowledgements, retry with backoff, and DLQ routing produce one payment effect and one reliable result event

#### AC-112 — Payment Federation compensates inventory failure

- **Dado** an approved card payment and an inventory reservation failure
- **Quando** the inventory capability inside the Java Payment Federation reacts to the payment event
- **Então** the order converges through a compensating payment event without duplicate stock or payment effects

### US-057 — Prove the complete public journey

As an evaluator, I want one Testcontainers journey to exercise every mandatory
component and assertion, so that acceptance reflects production behavior.

#### AC-113 — E2E starts every mandatory component

- **Dado** a clean Docker environment
- **Quando** the acceptance target starts the marketplace
- **Então** WordPress, databases, RabbitMQ, Gateway, Identity, order capability, Java Payment Federation with payment and inventory consumers, Apollo MCP, and telemetry dependencies required by the selected profile run from delivered images

#### AC-114 — E2E proves the complete buyer contract

- **Dado** seeded OAuth clients, a registered linked buyer, a product, and one multi-resource token
- **Quando** the buyer subscribes before checkout and executes Card and Pix journeys
- **Então** the test proves idempotent checkout, RabbitMQ choreography, compensation, final SSE state, federated `me` with orders and products, exact MCP parity, and mandatory negative authorization cases only through public protocols

### US-058 — Close the delivery with optional observability

As an operator, I want telemetry across the mandatory topology and one honest
final gate, so that the system is both reviewable and diagnosable.

#### AC-115 — Telemetry crosses RabbitMQ and Payment Federation

- **Dado** the optional local observability profile
- **Quando** the complete order journey runs
- **Então** trace context crosses Gateway, subgraphs, RabbitMQ, and the Payment Federation consumers while RED metrics and structured logs expose correlation identifiers without credentials

#### AC-116 — Final records and gates agree

- **Dado** the restored runtime, tests, existing import-order correction, and owner-confirmed deadline wording
- **Quando** quality, acceptance, specification verification, and CI audit gates run
- **Então** all mandatory gates pass, completed milestones and decisions reference current evidence, and only intentional delivery changes remain

## Out of scope

- Provisioning cloud infrastructure or requiring AWS credentials.
- Replacing WooCommerce as the commercial source of truth.
- Rewriting previously proven Commerce, inventory, or RabbitMQ components when they can be restored and adapted.
- Creating a separate stock-worker deployment when the Java Payment Federation can own the inventory reaction behind an internal application boundary.
- Making the optional observability profile a dependency of the default runtime.
- Inventing a delivery time or timezone without owner confirmation.

## Suposições

| ID      | Assumption                                                                                                                         | Status     | Resolution                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ASM-038 | The five-application topology satisfies the immutable challenge without RabbitMQ or an inventory reaction.                         | invalidada | README sections 1, 3, 5, 10, 14, 15, 16, 17, and 18 explicitly require RabbitMQ choreography, inventory reaction, compensation, and their E2E execution. |
| ASM-039 | OpenTelemetry remains optional and cannot replace mandatory choreography evidence.                                                 | confirmada | README sections 13 and 18.7 classify observability as optional or bonus.                                                                                 |
| ASM-040 | The deleted Commerce, Stock, and RabbitMQ implementation can be restored from repository history and adapted instead of rewritten. | confirmada | Commit `a2a37a3` deleted the previously passing runtime sources while preserving their full history.                                                     |
| ASM-041 | Payment and inventory may share one Java Payment Federation deployment.                                                            | confirmada | The owner confirmed this boundary, and README section 3 permits merging services when all section 5 capabilities remain present and justified.           |
| ASM-042 | The Java Payment Federation may call WooCommerce REST endpoints directly.                                                          | invalidada | The owner confirmed that Java-to-WooCommerce communication must use the federated WordPress GraphQL contract exposed by the installed plugins.           |

## Perguntas em aberto

| ID    | Question                                                      | Status     | Answer                                                                                    |
| ----- | ------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| Q-006 | What delivery time and timezone, if any, apply on 2026-09-03? | respondida | The owner confirmed a date-only deadline: 2026-09-03, with no committed time or timezone. |
