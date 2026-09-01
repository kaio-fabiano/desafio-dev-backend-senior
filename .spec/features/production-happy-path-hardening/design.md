# Design: Production happy path hardening

## NestJS documentation decisions

- Use `ApolloFederationDriver` and schema federation directives for ownership; do not duplicate WordPress cart mutations in Commerce.
- Inject GraphQL request data through Nest's GraphQL context/request scope while keeping external adapters singleton. Request scope contains context, not state.
- Model background messaging as singleton injectable providers implementing application bootstrap/shutdown hooks, with `enableShutdownHooks()` at the edge.
- Adopt the Nest RabbitMQ transporter only if its acknowledgements, prefetch, retry topology, and event envelope preserve current guarantees. Native syntax alone is not a reason to rewrite the broker adapter.
- Keep GraphQL-over-SSE because Apollo Federation does not support subscriptions. Do not use the default in-memory GraphQL PubSub in production; replay comes from durable workflow state and live delivery from cross-replica notification.
- Keep the explicit order state machine. Nest CQRS sagas are singleton in-process observable pipelines and do not supply durable inbox/outbox guarantees.
- Use guards, pipes, interceptors, and parameter decorators only for actual cross-cutting request concerns. Domain rules remain in services and objects.

## Dependency inversion and reusable NestJS primitives

- Resolvers depend on application use cases, never repositories or WooCommerce adapters.
- Application services depend on narrow TypeScript ports. Nest modules bind typed symbols to concrete infrastructure adapters with `useClass`, `useFactory`, or `useExisting`.
- A GraphQL federation guard validates the trusted internal request boundary. An authenticated-subject parameter decorator reads the already validated context, removing repeated `@Context()` parsing from resolvers.
- Authorization metadata and a guard express reusable policies such as subject ownership or required scopes. Domain ownership checks that require loaded entities stay in application services.
- Pipes validate and normalize GraphQL inputs and pagination arguments. Exception filters translate known application errors into stable GraphQL error codes. Interceptors are reserved for logging, tracing, and response concerns, not business orchestration.
- Singleton resource providers own ORM, RabbitMQ, timers, and notification connections through Nest lifecycle hooks. Request scope is limited to the entity-manager/request unit of work and immutable authentication/session context.
- Shared primitives live in `libs/platform/nest` only after two applications use the same contract. App-specific guards, ports, and decorators remain beside their bounded context until that threshold is met.
- Architecture tests enforce that domain/application layers do not import NestJS, MikroORM, AMQP, HTTP clients, or concrete adapters.
- Configure TypeScript for NestJS decorators and migrate manual calls such as `Resolver()(Class)` and `Inject(Token)(prototype, ...)` to idiomatic annotations. Constructor parameters at interface/port boundaries retain explicit `@Inject(TOKEN)`, so reflection metadata never becomes a hidden dependency on a concrete class.

## Target flow

1. The WordPress federated mutation owns the cart and returns session headers through the Gateway.
2. The Gateway propagates subject and opaque cart session to Commerce; Commerce reads the cart without process-local state.
3. Checkout claims a durable operation, reconciles a stable WooCommerce reference, and persists workflow plus outbox transactionally.
4. Payment and inventory consumers claim durable work before external effects, reconcile owner state after uncertainty, and acknowledge only after persistence.
5. Commerce persists transitions. SSE first replays the authorized snapshot, then follows cross-replica notifications without a registration gap.

## Review loop

For every task: implement the smallest vertical correction, run focused tests and affected lint, perform correctness/architecture/security review, fix all blocking and important findings, and rerun checks. The final task repeats the review over the complete happy path and executes repository-wide gates.
