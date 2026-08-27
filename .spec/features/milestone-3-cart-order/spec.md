# Spec: Milestone 3 — Cart and idempotent order

> feature: milestone-3-cart-order
> status: auditada

## Context

Milestone 2 authenticates the buyer and federates the WooCommerce catalog. This
feature completes the next vertical slice: the authenticated buyer maintains a
WooCommerce cart, creates one commercial order for one operation key, and reads
that order with its local workflow and products through the federated graph.
WooCommerce remains the source of truth for cart, order, items, and prices;
Commerce persists only the operation, workflow, and transactional outbox.

## Stories

### US-022 — Buyer maintains their cart

As an authenticated buyer, I want to add and remove catalog products from my
cart so that I can prepare a checkout without acting on another user's cart.

#### AC-033 — Cart mutations use the authenticated buyer

- **Dado** an authenticated buyer and a federated catalog product
- **Quando** the buyer adds or removes a valid quantity through the gateway contract
- **Então** the returned WooCommerce cart belongs to that token subject and reflects the change

#### AC-034 — Invalid cart changes are rejected

- **Dado** an authenticated buyer's cart
- **Quando** a caller supplies an invalid quantity or tries to substitute another user identity
- **Então** the cart remains unchanged and the request returns a deterministic input or authorization error

### US-023 — Buyer creates an idempotent order

As an authenticated buyer, I want to create an order with my client-generated
operation key so that retries never create a second commercial order.

#### AC-035 — Sequential retries return the original order

- **Dado** a non-empty cart and one operation key for the authenticated buyer
- **Quando** the same checkout command is submitted more than once
- **Então** every successful response identifies the same WooCommerce order and only one order is created

#### AC-036 — Concurrent retries create one order

- **Dado** a non-empty cart and one unused operation key for the authenticated buyer
- **Quando** equivalent checkout commands race concurrently
- **Então** the database constraint selects one operation and every successful retry converges on its single WooCommerce order

#### AC-037 — Reusing a key for a different command conflicts

- **Dado** an operation key already used by the authenticated buyer
- **Quando** the key is submitted with a different payment method or cart snapshot
- **Então** checkout fails with a deterministic idempotency conflict and creates no additional order

### US-024 — Checkout survives the WordPress transaction boundary

As the operations owner, I want an interrupted remote checkout to be resumable
so that a crash between WooCommerce and PostgreSQL does not duplicate or lose an order.

#### AC-038 — Pending WooCommerce checkout is reconciled

- **Dado** WooCommerce created an order with the stable operation reference before local confirmation failed
- **Quando** checkout is retried or reconciliation runs
- **Então** Commerce finds that order by reference, completes the workflow and outbox atomically, and does not create another order

#### AC-039 — Workflow and event are committed together

- **Dado** a new operation ready for local confirmation
- **Quando** Commerce records the WooCommerce order identifier
- **Então** the workflow and one unsent checkout event are visible together or neither is visible

### US-025 — Buyer reads the complete federated order journey

As an authenticated buyer, I want `me` to include my orders and their products
so that one gateway query returns the commercial order and its local workflow.

#### AC-040 — Federated `me` returns orders, workflow, and products

- **Dado** an authenticated buyer with a completed checkout operation
- **Quando** the buyer queries `me` through the gateway with order and product fields
- **Então** only that buyer's WooCommerce orders are returned as a Connection and each order resolves its Commerce workflow and catalog products without per-item calls

## Out of scope

- Payment processing, inventory reservation, compensation, retry queues, and DLQ.
- RabbitMQ publication and publisher confirms; this milestone persists the outbox only.
- GraphQL subscriptions and terminal Card/Pix states.
- Apollo MCP tools and a custom terminal UI.
- A second local representation of the WooCommerce cart or commercial order.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-009 | WooCommerce remains authoritative for cart and commercial order data. | confirmada | README sections 9 and 15 plus ADR 003 require plugin-first reuse; Commerce stores only operation/workflow metadata. |
| ASM-010 | The client operation key is scoped by authenticated subject. | confirmada | PRD 04 and risk D-006 define the unique pair `(subject, operationKey)`. |
| ASM-011 | Payment and stock consumers may be added after an outbox row exists. | confirmada | The roadmap assigns processing to Milestone 4 and subscription delivery to Milestone 5. |

## Perguntas em aberto

None.
