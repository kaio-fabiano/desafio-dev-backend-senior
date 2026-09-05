# Design: Modularize order workflow subgraph

## Objective

Replace the single `OrderWorkflowModule` composition with focused NestJS modules whose locations match their responsibilities. This is a structural refactor, not a domain redesign.

## Target composition

```text
AppModule
├── PersistenceModule
├── CheckoutModule
├── OrderEventsModule
├── MessagingModule
└── OrderWorkflowGraphqlModule
```

- `PersistenceModule` owns the MikroORM instance and request-scoped `EntityManager`.
- `CheckoutModule` owns WooCommerce integration, checkout repositories, outbox writes, and `CheckoutService`.
- `OrderEventsModule` owns in-process brokering, database replay, PostgreSQL relay, and GraphQL subscription service APIs.
- `MessagingModule` owns RabbitMQ runtime composition and its lifecycle.
- `OrderWorkflowGraphqlModule` owns GraphQL bootstrap, resolvers, operation facade, authorization guard, and SSE transport.
- `AppModule` is the only application-wide composition root and exposes health checks.

## Folder decisions

```text
src/
├── checkout/
├── graphql/
│   └── sse/
├── inbox/
├── messaging/
├── order-events/
│   └── postgres/
├── outbox/
├── persistence/
└── saga/
```

`inbox`, `outbox`, and `saga` remain implementation folders rather than gaining one-file modules. SSE belongs to `graphql` because it is an authenticated transport over the GraphQL subscription API. PostgreSQL replay and relay stay visibly grouped as order-event infrastructure.

## Dependency direction

- Transport imports services exported by focused modules.
- Checkout and messaging import persistence, never GraphQL.
- Persistence entities import neutral types from their owning resource, never adapter ports solely to obtain a type.
- Tokens live beside the module that owns the provider.
- Modules export only providers used outside their boundary.

## Compatibility

The refactor preserves GraphQL schema and resolver behavior, SSE paths and authorization, PostgreSQL schema and migrations, RabbitMQ topology and delivery semantics, WooCommerce calls, checkout idempotency, health behavior, and shutdown behavior.

## Verification strategy

Each extraction starts with focused module or collaborator tests, followed by existing unit and integration suites. The final task runs coverage, typecheck, lint, `onp-spec verify`, and `onp-spec audit --ci` and records evidence.
