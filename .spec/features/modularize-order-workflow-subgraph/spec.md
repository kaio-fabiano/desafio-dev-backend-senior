# Spec: Modularize order workflow subgraph

> feature: modularize-order-workflow-subgraph
> status: rascunho

## Contexto

The `order-workflow-subgraph` concentrates persistence, checkout, events, messaging, and GraphQL transport in one NestJS module inside the `graphql` folder. This makes provider ownership ambiguous and forces non-transport components to depend on GraphQL files. The reorganization must establish focused NestJS modules and responsibility-oriented folders without introducing DDD or changing public behavior.

## Histórias

### US-117 — Navigate and evolve the subgraph by responsibility

As an `order-workflow-subgraph` developer, I want every responsibility to have a coherent folder and NestJS module so that I can locate dependencies and change the service without relying on a monolithic module or artificial boundaries.

#### AC-246 — Persistence has its own module

- **Dado** the bootstrap and providers that use MikroORM
- **Quando** the NestJS composition is loaded
- **Então** ORM configuration and the request-scoped `EntityManager` are provided by a persistence module without depending on tokens defined inside `graphql`

#### AC-247 — Checkout has its own module

- **Dado** the checkout flow that uses WooCommerce, the operation repository, and the outbox
- **Quando** its providers are resolved by NestJS
- **Então** they are provided by a checkout module with explicit dependencies and unchanged checkout behavior

#### AC-248 — Order events have a coherent boundary

- **Dado** the order-event broker, replay, relay, and subscription
- **Quando** the subgraph structure is inspected and the application starts
- **Então** these components belong to an order-events module and folder while SSE transport stays with GraphQL, without changing replay, delivery, or authorization

#### AC-249 — Messaging and saga processing have separate responsibilities

- **Dado** the RabbitMQ runtime and persistent event processing
- **Quando** order and payment messages are consumed
- **Então** the messaging module composes the runtime and the consumer delegates persistence and notification to focused collaborators while preserving idempotency, retries, DLQ, and outbox publication

#### AC-250 — GraphQL is only the transport boundary

- **Dado** the resolvers, GraphQL operations, guard, and authenticated SSE endpoint
- **Quando** the GraphQL module is loaded
- **Então** it imports the required business and infrastructure modules and does not declare persistence, checkout, event, or messaging providers

#### AC-251 — Public behavior remains unchanged

- **Dado** the reorganization of modules, tokens, types, and files
- **Quando** unit and integration suites, coverage, typecheck, and lint run
- **Então** the GraphQL schema, HTTP/SSE contracts, database, RabbitMQ topology, and checkout rules remain compatible and every gate passes

## Fora de escopo

- Changing the GraphQL schema, SSE/HTTP contracts, migrations, or persisted entities.
- Changing checkout rules, retries, backoff, DLQ, idempotency, or RabbitMQ topology.
- Introducing DDD layers, additional ports, or individual modules for `inbox`, `outbox`, and `saga`.
- Replacing MikroORM, RabbitMQ, Fastify, Mercurius, or any dependency.
- Redesigning environment configuration beyond what is required to move providers to their owning modules.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-083 | The refactor must be exclusively structural and preserve all existing contracts and behavior. | confirmada | The user accepted the reorganization proposal after the complete review. |
| ASM-084 | The desired structure follows NestJS modules and resources without adopting DDD. | confirmada | The user previously clarified that the project is not structured with DDD. |

## Perguntas em aberto

None.
