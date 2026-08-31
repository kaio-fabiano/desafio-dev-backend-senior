# PRD 06 — Platform, quality, and delivery

## Expected outcome

A clean clone installs dependencies, composes schemas, builds images, starts the
entire system, and runs the E2E without manual services. The same topology has a
reproducible path to AWS through SST.

## Nx as the monorepo engine

- each app/lib is an Nx project with boundary tags;
- uniform targets: `lint`, `typecheck`, `test`, `build`, `docker`;
- `targetDefaults` declares dependencies and cache;
- `nx affected` runs PR validations;
- custom generators create bounded contexts, subgraphs, and contracts following the standard;
- the project graph and module-boundary lint demonstrate architecture;
- Rover and codegen outputs correctly enter the cache.
- `@nx/gradle` registers the Spring Boot processor and its Gradle tasks in the
  same project graph, so `affected`, caching, and CI apply across languages;
- use Nx's dynamic terminal output, Nx Console, and `nx graph` as the centralized
  operator experience; build a custom TUI only after a documented workflow gap.

## Docker Compose

The local environment includes the gateway, three subgraphs, MCP, payment
processor, stock worker, WordPress/WooCommerce, RabbitMQ, and databases. Each
container has a healthcheck without relying solely on an “open port”. App images
are multi-stage, run as a non-root user where possible, and receive configuration
through the environment.

Order is controlled by actual readiness in Testcontainers; `depends_on` does not
prove that migrations, plugins, or schemas have finished.

## E2E with Vitest and Testcontainers

The test must be written early and grow through milestones. Testcontainers treats
dependencies as code and removes containers at the end.

Proposed harness:

1. creates an isolated network;
2. starts databases, RabbitMQ, and WordPress;
3. installs/activates plugins and runs migrations/seeds;
4. starts apps and waits for readiness endpoints;
5. runs the complete README scenario;
6. collects logs/counters on failure;
7. shuts down resources even when an error occurs.

Splitting the file into helpers does not split the journey: there must be a
single orchestrator test that proves the system from scratch.

### Interview rule: test through the federated gateway

All functional, cross-domain contract, and acceptance proof goes through the
public federated gateway API. The E2E does not call WordPress or a subgraph
directly to prove behavior. Unit and component tests may still exercise isolated
modules, but they do not replace gateway evidence. Rover remains responsible for
static schema composition.

## Test pyramid

| Level | Focus |
|---|---|
| Unit | Order and Payment invariants, transitions, and cursors |
| Integration | real repositories, Better Auth, outbox/inbox, Woo adapter |
| Contract | versioned SDL and events; cross-domain operations through the gateway |
| Composition | Rover and reference resolvers |
| E2E | complete journey from section 15, exclusively through the public gateway/MCP |
| Load | gateway P95 and absence of N+1 |

Coverage ≥ 70% is the floor for critical domains, not a target for glue code.

## Proposed CI

```text
install --frozen-lockfile
  -> format/lint/typecheck
  -> rover compose + schema checks
  -> nx affected test/build
  -> unit/integration coverage
  -> build Docker images
  -> E2E Testcontainers
  -> sst diff --stage pr-<number>
  -> deploy controlado em branch protegida
```

Pin versions of Node, pnpm, Nx, Rover, Docker images, and SST. Current SST
provides `sst diff --json`, useful for CI and reviewing the plan before deployment.

## SST

- versioned `infra/sst.config.ts`;
- containerized services in a VPC as needed;
- managed databases/queues or justified alternatives;
- secrets through `sst.Secret`/Secrets Manager;
- stages for dev, PR, and production;
- `sst diff` in PRs and `sst deploy` only with approved credentials/environment;
- no AWS credentials required for the local E2E.

The challenge requires SST v3; current documentation is already on a later
generation. Explicitly pin a version compatible with the requirement or record
acceptance for current SST before implementing infrastructure.

## Incremental observability

After the functional journey:

- gateway `traceparent` in calls to subgraphs and RabbitMQ envelopes;
- JSON logs with `requestId`, `correlationId`, `eventId`, `trace_id`, without tokens;
- RED metrics per operation/resolver and queue consumption;
- outbox, publish, consume, and WooCommerce call spans;
- optional local collector + backend in Compose.

## Security and operations

- secret scanning and dependabot/renovate;
- non-root containers and minimal images;
- payload limits, GraphQL depth/complexity limits, and timeouts;
- explicit CORS and SSE headers;
- graceful shutdown: stop consumption, drain, and close connections;
- idempotent migration job;
- documented backup/restore for authoritative data.

## Sources

- [Nx — Run Tasks](https://nx.dev/docs/features/run-tasks)
- [Nx — Cache](https://nx.dev/docs/features/cache-task-results)
- [Testcontainers](https://testcontainers.com/)
- [SST CLI](https://sst.dev/docs/reference/cli/)
- [NestJS Hybrid Application](https://docs.nestjs.com/faq/hybrid-application)
