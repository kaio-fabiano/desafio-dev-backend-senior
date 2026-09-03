# PRD 08 — Risks and pending decisions

> Do not implement decisions marked as open without a PoC or confirmation.

## Prioritized register

| ID    | Risk/question                                                               | Impact                                                                                                             | Recommendation                                                                                                          | Closing gate                                                                                                                | Status                      |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| D-001 | `graphql-sse` is not the Apollo Router multipart protocol                   | gateway architecture may fail the core requirement                                                                 | end-to-end PoC before final apps; consider a custom NestJS gateway with a separate subscriptions pipeline               | client→gateway→subgraph `text/event-stream` test and federated query over the payload                                       | open                        |
| D-002 | Multi-resource token interoperability between Better Auth, gateway, and MCP | version/configuration regression may cause a resource to reject the token                                          | request the gateway and MCP through repeated RFC 8707 `resource` parameters; keep strict validation in both             | positive test on both resources and negative test for an unlisted audience                                                  | decided; PoC pending        |
| D-003 | Compatibility of the indicated plugin with WooCommerce and Federation v2    | the direct plugin may not cover Woo entities, composition, batching, or ownership                                  | try `wp-graphql-federations` first and add only the smallest necessary fallback                                         | `Product`/`Order @key`, Relay Connections, ID batching, mutations with ownership, and clean composition through the gateway | decided; PoC pending        |
| D-004 | Payment processor language and provider                                     | affects runtime ownership, financial semantics, and operational support                                            | Java 21 in Payment Federation with Mercado Pago behind the existing provider port                                       | credential-free provider contracts plus the opt-in sandbox runbook                                                          | decided; local proof complete; sandbox pending |
| D-005 | A Pix terminal state does not imply confirmed payment                       | inventory may remain reserved without payment                                                                      | end Milestone 4 in `PIX_GENERATED` without reserving inventory; payment confirmation and expiration remain future scope | Card reservation tests plus a Pix test proving no stock command                                                             | decided for Milestone 4     |
| D-006 | Idempotency-key scope                                                       | collision between users or enumeration leak                                                                        | `(userId, operationKey)` constraint and indistinguishable authorization                                                 | tests between two users and divergent payloads                                                                              | proposed                    |
| D-007 | Registration rollback if WordPress fails                                    | partially created identity                                                                                         | compensate if the API allows it; otherwise, pending state + reconciler                                                  | fault injection in the WordPress adapter                                                                                    | open                        |
| D-008 | SST version                                                                 | README requires v3; current docs are on a later generation                                                         | keep SST on v3 until explicit approval to migrate                                                                       | ADR 004 records the constraint                                                                                              | decided                     |
| D-009 | `08/07/2026 12:00 BRT` deadline                                             | the historical date has expired                                                                                    | use the owner-confirmed date-only deadline `2026-09-03`; do not carry over the old time or timezone                     | ADR 004 and owner response                                                                                                  | closed; date only           |
| D-010 | General `users` list                                                        | risk of PII exposure                                                                                               | require an administrative role/scope and limit fields                                                                   | authorization test and approved policy                                                                                      | proposed                    |
| D-011 | WooCommerce order integration with local idempotency and saga               | duplicating the order would create two sources of truth; remote writes are not transactional with the local outbox | WooCommerce is the commercial system of record; commerce stores only the operation/workflow and `wooOrderId` reference  | idempotent checkout PoC + failure between Woo and local persistence + reconciliation                                        | decided; PoC design pending |
| D-012 | Licensing/use of GraphOS Router and Apollo MCP                              | may affect local execution and deployment                                                                          | pin the official self-hosted Apollo MCP image and keep schema/operations local                                          | the pinned image starts in CI without GraphOS credentials                                                                   | decided                     |

## Production-readiness gap register

Passing challenge acceptance proves the delivered behavior, not production
readiness. A gap remains open until its acceptance evidence exists; roadmap
intent, local Compose evidence, and deterministic adapters are not substitutes.

| ID | Priority | Area | Current evidence | Target state | Dependencies | Acceptance evidence | ADR trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-001 | P0 | Payment | Mercado Pago is selected behind `PaymentProvider`; credential-free contracts cover Card tokens, Pix payloads, idempotency, authenticated replay-safe webhooks, authoritative lookup, ambiguity recovery, refunds, and fail-closed configuration. | Credentialed sandbox evidence and production approval confirm the same controls with a managed secret store and public HTTPS webhook ingress. | Legal/commercial approval, sandbox credentials, webhook ingress, secret storage, and an authorized production environment. | Redacted sandbox Card/Pix/refund evidence, invalid-signature rejection, duplicate-webhook replay, timeout reconciliation, credential rotation, and the operational runbook. | Change provider or financial invariants, expand PCI scope, or authorize the first real-money environment. |
| G-002 | P0 | Infrastructure | `infra/sst.config.ts` validates pinned SST syntax and a partial service graph without deploying billable resources. | Versioned dev/PR/production stages deploy the complete runtime, databases, networking, TLS/DNS, autoscaling, readiness dependencies, migrations, and post-deploy smoke tests. | Target AWS account/region, cost envelope, domain/DNS, topology sizing, and approved deployment credentials. | `sst diff`, isolated-stage deploy, migration execution, public smoke journey, rollback exercise, and resource/inventory evidence from CI. | Choose managed versus self-hosted data/broker services, change network boundaries, or authorize the first real environment. |
| G-003 | P0 | WordPress | Compose installs pinned plugins and proves native WPGraphQL/WooCommerce behavior, HPOS reconciliation, and federation. | An immutable WordPress image runs pinned reviewed plugins with durable database/uploads, controlled upgrades, cache strategy, least-privilege service credentials, and rollback. | Infrastructure target, object storage/CDN decision, database plan, plugin release policy, and backup design. | Image provenance/SBOM, clean-environment install, plugin upgrade rehearsal, HPOS compatibility suite, credential rotation, backup restore, and rollback smoke test. | Change plugin distribution, persistence, caching, tenancy, or WordPress hosting model. |
| G-004 | P1 | Messaging | Local RabbitMQ proves confirms, acknowledgements, retry/backoff, DLQ routing, and idempotent consumers. | A durable highly available broker has quorum policies, TLS, per-service credentials, resource alarms, tested failover, replay tooling, and poison-message operations. | Infrastructure target, availability objective, traffic envelope, and managed-versus-self-hosted decision. | Node-loss/failover test, publisher/consumer recovery, DLQ replay drill, credential rotation, capacity test, and alert evidence without duplicate effects. | Select the broker hosting model, topology, retention policy, or cross-region recovery requirement. |
| G-005 | P1 | Recovery | Migrations and idempotent workflows are tested locally; no production backup/restore or regional recovery evidence exists. | Every authoritative store has encrypted backups, explicit RPO/RTO, restore automation, migration rollback policy, and rehearsed service recovery. | Data classification, infrastructure target, storage inventory, retention policy, and business RPO/RTO. | Scheduled backup evidence, point-in-time restore into isolation, integrity checks, full buyer-journey smoke, and measured RPO/RTO drill. | Approve retention/RPO/RTO, add an authoritative store, or adopt multi-region recovery. |
| G-006 | P1 | Security | Authentication, audience/scope enforcement, ownership guards, non-root images, and secret-safe local tests are executable. | Production adds managed secrets and rotation, TLS, WAF/rate and payload limits, GraphQL depth/complexity controls, vulnerability/SBOM scanning, audit retention, and incident response. | Public domains, threat model, cloud account, data classification, security ownership, and compliance requirements. | DAST/SAST/dependency/image gates, rotation drill, abuse/load rejection tests, TLS/header scan, authorization regression suite, and incident-response exercise. | Expose a public environment, process real payment/PII data, or change trust boundaries. |
| G-007 | P1 | Observability | Optional local OpenTelemetry proves trace propagation, RED metrics, structured correlation, and secret-free logs. | Production telemetry has retained traces/logs/metrics, service and business SLOs, actionable alerts, dashboards, sampling/cardinality budgets, and on-call runbooks. | Observability backend, availability objectives, ownership/on-call model, and cost/retention budget. | Synthetic checkout traces, alert firing/recovery tests, dashboard review, log-redaction tests, and an incident drill tied to SLOs. | Select the telemetry backend, define SLOs, or establish on-call ownership. |
| G-008 | P1 | Identity recovery | Registration links Better Auth and WordPress and proves normal authorization, but WordPress failure compensation/reconciliation remains undecided. | Registration has a durable pending state or safe compensation, replayable reconciliation, operator visibility, and no orphan identity ambiguity. | Product policy for partial registration, WordPress deletion/link semantics, and retention requirements. | Fault injection before/after WordPress creation/linking, retry/reconciler tests, orphan detection, and an operator recovery runbook. | Choose compensation versus pending-state reconciliation or change identity ownership. |
| G-009 | P2 | Capacity and quality | Unit, integration, architecture, composition, and full local E2E gates pass; production traffic characteristics are unknown. | Representative workloads meet agreed latency/error/throughput objectives with bounded GraphQL, database, queue, SSE, WordPress, and cost behavior. | Workload model, dataset shape, SLOs, infrastructure stage, and cost ceiling. | Reproducible load/soak tests, P95/P99 and error budgets, N+1/query evidence, queue-lag/SSE concurrency results, scaling test, and cost report. | Define SLOs or discover a capacity limit that changes topology, caching, or data access. |

Priority means ordering, not permission to deploy. `P0` blocks the first real
production environment; `P1` blocks operating it responsibly; `P2` blocks a
capacity claim. Newly discovered gaps must be added here with the same closure
contract before implementation begins.

## D-001 — Mandatory PoC for federated subscriptions over SSE

### Why it is a blocker

`graphql-sse` uses `text/event-stream`. Apollo Router documentation describes
multipart HTTP for router→client and WebSocket or HTTP callback for
router→subgraph. Therefore, choosing Apollo Router and renaming multipart as SSE
would violate the observable requirement.

### Alternatives matrix

| Alternative                                                              | Advantage                                             | Problem                                                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Pure Apollo Router                                                       | official federated subscriptions and high performance | client transport is multipart, not `graphql-sse`                           |
| `@apollo/gateway` + custom SSE endpoint                                  | keeps the NestJS gateway and transport control        | federated Subscription execution is not provided out of the box; high risk |
| Hybrid gateway: Apollo for query/mutation + SSE service at the same edge | isolates risk and meets the SSE endpoint requirement  | needs to hydrate the federated payload without bypassing auth/N+1          |
| Change the requirement to multipart                                      | solution more aligned with Router                     | requires explicit authorization; does not currently meet the README        |

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

## D-012 — Self-hosted Apollo MCP

Apollo MCP Server 1.17.0 is distributed under the MIT license and publishes the
official `ghcr.io/apollographql/apollo-mcp-server:v1.17.0` OCI image. The local
image derives directly from that version, copies only the pinned client schema,
reviewed operations, and configuration, and requires neither an Apollo key nor a
GraphOS graph reference at build or runtime.

The Nx `container-smoke` target builds the derived image and starts its official
binary with `--version`. The feature acceptance target separately starts the
authenticated Streamable HTTP service against the local gateway and identity
provider.

Evidence: [v1.17.0 release](https://github.com/apollographql/apollo-mcp-server/releases/tag/v1.17.0),
[MIT license at v1.17.0](https://github.com/apollographql/apollo-mcp-server/blob/v1.17.0/LICENSE),
and [official OCI package declaration](https://github.com/apollographql/apollo-mcp-server/blob/v1.17.0/server.json).

## Questions for the product/challenge owner

1. For Pix, does the saga end when generating the code, or must it also reserve inventory?
2. Must SST remain exactly v3, even with a later current version? (ADR 004 keeps this as the current constraint until approval.)

## Maintenance rule

When closing a decision, create an ADR with context, alternatives, decision,
consequence, and evidence. Update this register and the affected PRDs in the same commit.
