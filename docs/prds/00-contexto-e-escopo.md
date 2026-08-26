# PRD 00 — Context, scope, and success

## Problem

Build a federated B2B marketplace API that combines first-party identity,
WooCommerce catalog and orders, asynchronous checkout, real-time tracking, and
curated access by AI agents without sacrificing authorization, idempotency, or
verifiability.

## Personas

| Persona | Primary need | Security boundary |
|---|---|---|
| Buyer | browse, maintain a cart, pay, and track orders | accesses only their own cart/orders |
| Supplier | manage products for their own company | never changes a third party's product |
| Agent via MCP | query profile/catalog and operate a cart | curated tools only, under the token identity |
| Operations | start, observe, and recover the platform | stateless services and traceable events |
| Evaluator | reproduce the entire journey with one command | no prerequisites beyond Docker/toolchain |

## Critical journey

1. The seed creates two OAuth2 clients: a test client and Apollo MCP.
2. Sign-up creates an identity in Better Auth, a user in WordPress, and a
   `wordpress` link in the `accounts` table, in addition to the `email` account.
3. The test creates product X in WordPress and obtains an OAuth2 token.
4. The same user accesses the supergraph and connects the MCP client.
5. Product X is added to the authenticated cart.
6. The client generates an operation key and opens the subscription before ordering.
7. An order is created with the same key; the saga processes payment and inventory.
8. The stream reaches the final state; `me` hydrates the user, orders, and products.
9. `me` via MCP is identical to direct GraphQL.
10. Retrying the mutation does not create a duplicate order or charge.

## Minimum scope

- Federated gateway and identity, commerce, and catalog subgraphs.
- WordPress + WooCommerce as the catalog/order source required by the challenge.
- Better Auth as the OAuth 2.1/OIDC Authorization Server.
- RabbitMQ, a choreographed saga, outbox/inbox, and a processor in another runtime.
- GraphQL subscriptions over `graphql-sse`.
- Authenticated Apollo MCP pointing to the supergraph.
- Docker Compose, Testcontainers, CI, and SST.

## Initially out of scope

- Production frontend; the E2E client represents the journey.
- Full WordPress back office.
- Real capture through a payment acquirer.
- Historical subscription replay; it is a differentiator, not a minimum requirement.
- OpenTelemetry before the critical journey is passing.

## Success metrics

| Metric | Target |
|---|---|
| Required E2E | 100% passing from a clean state |
| Supergraph composition | zero errors |
| Order/payment coverage | ≥ 70% |
| Local gateway query P95 | < 500 ms |
| Duplication under the same key | zero duplicate orders and zero extra charges |
| N+1 in the `me` query | batched calls, recorded evidence |
| Versioned secrets | zero |

## Time constraint

The README states a delivery deadline of **08/07/2026 at 12:00 BRT**. As of the
date of this note (2026-08-25), that deadline appears to have elapsed if the
format is DD/MM/YYYY. The validity of the deadline must be confirmed before
using the roadmap for an external commitment.
