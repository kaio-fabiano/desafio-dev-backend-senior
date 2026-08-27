# PRD 08 — Risks and pending decisions

> Do not implement decisions marked as open without a PoC or confirmation.

## Prioritized register

| ID | Risk/question | Impact | Recommendation | Closing gate | Status |
|---|---|---|---|---|---|
| D-001 | `graphql-sse` is not the Apollo Router multipart protocol | gateway architecture may fail the core requirement | end-to-end PoC before final apps; consider a custom NestJS gateway with a separate subscriptions pipeline | client→gateway→subgraph `text/event-stream` test and federated query over the payload | open |
| D-002 | Multi-resource token interoperability between Better Auth, gateway, and MCP | version/configuration regression may cause a resource to reject the token | request the gateway and MCP through repeated RFC 8707 `resource` parameters; keep strict validation in both | positive test on both resources and negative test for an unlisted audience | decided; PoC pending |
| D-003 | Compatibility of the indicated plugin with WooCommerce and Federation v2 | the direct plugin may not cover Woo entities, composition, batching, or ownership | try `wp-graphql-federations` first and add only the smallest necessary fallback | `Product`/`Order @key`, Relay Connections, ID batching, mutations with ownership, and clean composition through the gateway | decided; PoC pending |
| D-004 | Payment processor language | affects timeline, image, and architectural contrast | Go, with `internal/domain`, `application`, `ports`, `adapters` | RabbitMQ + Postgres + graceful shutdown spike | proposed |
| D-005 | A Pix terminal state does not imply confirmed payment | inventory may remain reserved without payment | at minimum, end in `PIX_GENERATED`; decide whether the reservation is deferred or temporary | approved rule and expiration/compensation test | open |
| D-006 | Idempotency-key scope | collision between users or enumeration leak | `(userId, operationKey)` constraint and indistinguishable authorization | tests between two users and divergent payloads | proposed |
| D-007 | Registration rollback if WordPress fails | partially created identity | compensate if the API allows it; otherwise, pending state + reconciler | fault injection in the WordPress adapter | open |
| D-008 | SST version | README requires v3; current docs are on a later generation | keep SST on v3 until explicit approval to migrate | ADR 004 records the constraint | decided |
| D-009 | `08/07/2026 12:00 BRT` deadline | the historical date has expired | use the owner-confirmed date `2026-09-03`; do not carry over the old time or timezone without confirmation | ADR 004 and owner response on 2026-08-26 | confirmed date; time pending |
| D-010 | General `users` list | risk of PII exposure | require an administrative role/scope and limit fields | authorization test and approved policy | proposed |
| D-011 | WooCommerce order integration with local idempotency and saga | duplicating the order would create two sources of truth; remote writes are not transactional with the local outbox | WooCommerce is the commercial system of record; commerce stores only the operation/workflow and `wooOrderId` reference | idempotent checkout PoC + failure between Woo and local persistence + reconciliation | decided; PoC design pending |
| D-012 | Licensing/use of GraphOS Router and Apollo MCP | may affect local execution and deployment | verify self-hosted mode and the pinned version's license | images start in CI without an unexpected dependency | open |

## D-001 — Mandatory PoC for federated subscriptions over SSE

### Why it is a blocker

`graphql-sse` uses `text/event-stream`. Apollo Router documentation describes
multipart HTTP for router→client and WebSocket or HTTP callback for
router→subgraph. Therefore, choosing Apollo Router and renaming multipart as SSE
would violate the observable requirement.

### Alternatives matrix

| Alternative | Advantage | Problem |
|---|---|---|
| Pure Apollo Router | official federated subscriptions and high performance | client transport is multipart, not `graphql-sse` |
| `@apollo/gateway` + custom SSE endpoint | keeps the NestJS gateway and transport control | federated Subscription execution is not provided out of the box; high risk |
| Hybrid gateway: Apollo for query/mutation + SSE service at the same edge | isolates risk and meets the SSE endpoint requirement | needs to hydrate the federated payload without bypassing auth/N+1 |
| Change the requirement to multipart | solution more aligned with Router | requires explicit authorization; does not currently meet the README |

### Minimum experiment

1. schemas from two subgraphs with `Subscription.orderEvent` returning an entity
   that gains a field in the second subgraph;
2. token propagated through both segments;
3. `graphql-sse` client receives `text/event-stream`;
4. event is hydrated by both subgraphs;
5. cancellation closes resources;
6. test proves WebSocket is not used.

## D-002 — Audience and the “same token”

Decision: issue a single JWT access token for the gateway and MCP, requesting
both as RFC 8707 resources. Better Auth keeps `aud` as a reserved claim, accepts
repeated `resource` parameters, and applies the policies of the selected
resources. The gateway accepts only its audience; the MCP accepts only its own
and keeps `allow_any_audience: false`; any third resource rejects the token.

No claims callback will be used to override `aud`. The automated PoC must
confirm the exact JWT format and passthrough in the version set pinned by the
lockfile.

## D-003 — WordPress plugin-first

The interview guidance is not to recreate what WordPress already provides. The
first option will be WPGraphQL + WPGraphQL for WooCommerce with the indicated
`wp-graphql-federations`. The plugin commit will be pinned and tested; its
Federation v2 support statement does not replace Rover composition or gateway
tests for entities, Relay, authorization, and N+1.

If the PoC fails, the response will be incremental: plugin configuration/filter,
a minimal fork, and, only as a last resort, a NestJS adapter/subgraph for the
gap. A general wrapper replicating the entire WooCommerce schema is not allowed.

## D-011 — Who owns the order

WooCommerce will be the authoritative source for the commercial order. The
commerce subgraph contains only a cart when the existing one cannot be reused,
idempotency, `OrderWorkflow`, outbox, and stream. The supergraph associates this
workflow with the WooCommerce `Order` through `wooOrderId`.

The PoC still needs to resolve the failure window between creating the remote
order and confirming the local operation. The solution must use an idempotent
reference and reconciliation, without creating a competing authoritative copy of
the order.

## Questions for the product/challenge owner

1. What time and timezone apply to the confirmed 2026-09-03 deadline?
2. For Pix, does the saga end when generating the code, or must it also reserve inventory?
3. Must SST remain exactly v3, even with a later current version? (ADR 004 keeps this as the current constraint until approval.)

## Maintenance rule

When closing a decision, create an ADR with context, alternatives, decision,
consequence, and evidence. Update this register and the affected PRDs in the same commit.
