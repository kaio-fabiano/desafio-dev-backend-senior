# Tasks: Milestone 5 — GraphQL subscriptions over SSE

> feature: milestone-5-subscription-sse

## T-036 — Define the subscription and event contracts [concluida]
- Refs: US-031, US-032, AC-053, AC-054, AC-056, AC-057
- Arquivos: libs/contracts/graphql/commerce/schema.graphql, libs/contracts/events/order-workflow-transitioned.v1.schema.json, test/milestone-5-subscription-contract.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Extend the existing Commerce schema with `Subscription.orderEvents(operationKey: ID!): OrderEvent!`. Keep the payload limited to operation key, order reference, state, optional Pix code, and event time.

## T-037 — Publish committed workflow transitions through RabbitMQ [pendente]
- Refs: US-031, AC-053, AC-054
- Arquivos: apps/commerce-subgraph/src/saga/order-event.consumer.ts, apps/commerce-subgraph/src/subscriptions/order-transition.publisher.ts, apps/commerce-subgraph/src/messaging/rabbitmq.ts, libs/contracts/events/order-workflow-transitioned.v1.schema.json, test/milestone-5-transition-publication.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: This is a transaction and delivery-boundary change. Publish only committed applied transitions, preserve state order, include the owning subject and operation key for routing, and do not emit ignored or duplicate deliveries.

## T-038 — Implement the authenticated Commerce SSE subscription source [pendente]

- Refs: US-031, US-032, US-033, AC-053, AC-054, AC-056, AC-058
- Arquivos: apps/commerce-subgraph/src/subscriptions/order-events.subscription.ts, apps/commerce-subgraph/src/subscriptions/order-event-broker.ts, apps/commerce-subgraph/src/graphql/commerce.module.ts, apps/commerce-subgraph/src/graphql/commerce.resolver.ts, test/milestone-5-commerce-subscription.test.mjs, test/milestone-5-subscription-lifecycle.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Consume the live transition route into bounded per-stream async iterators filtered by `(subject, operationKey)`. Configure heartbeat, idle timeout, finite buffering, terminal completion, and deterministic cleanup. No replay store.

## T-039 — Add the hybrid GraphQL SSE endpoint to the gateway [pendente]
- Refs: US-032, US-033, AC-055, AC-057, AC-058
- Arquivos: package.json, pnpm-lock.yaml, apps/gateway/src/app.module.ts, apps/gateway/src/main.ts, apps/gateway/src/subscriptions/sse-handler.ts, apps/gateway/src/subscriptions/commerce-subscription.client.ts, test/milestone-5-gateway-sse.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Reuse the Milestone 0 hybrid adapter and the existing gateway verifier. Authenticate before allocating the delegated `graphql-sse` client, propagate the trusted subject, and abort the downstream stream on cancellation. Keep query and mutation federation unchanged.

## T-040 — Assemble the Milestone 5 end-to-end acceptance gate [pendente]

- Refs: US-031, US-032, US-033, AC-053, AC-054, AC-055, AC-056, AC-057, AC-058, AC-059
- Arquivos: apps/poc-harness/project.json, test/milestone-5-subscription-sse.test.mjs, docs/runbooks/milestone-5-subscription-sse.md, onpspec.config.json, .github/workflows/ci.yml
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Exercise real `graphql-sse` streams opened before mutations for Card and Pix. Prove isolation, protocol headers, lifecycle cleanup, and terminal equality with the read model through one Nx target.
