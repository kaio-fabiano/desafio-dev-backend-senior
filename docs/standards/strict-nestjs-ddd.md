# Strict NestJS DDD standard

This is the mandatory contract for TypeScript and NestJS production code. It
governs structure and ownership without changing public API, persistence, or
transport behavior.

## Strategic design and ownership

- A bounded context owns one cohesive business capability, its invariants, and
  its authoritative state. Identity owns authentication and identity data;
  Commercial owns catalog, cart, checkout, orders, customers, and inventory;
  Workflow owns checkout delivery mechanics; Payment owns payment state; Edge
  composes and authenticates but owns no business persistence.
- Cross-context collaboration uses versioned contracts or federated references.
  It never imports another context's domain, application, adapter, or database.
- Each use case has one owning context and one explicit application entry
  point. A use case must not hide business decisions in controllers, resolvers,
  modules, repositories, or transport adapters.

## Tactical design

- Aggregates protect invariants and expose methods for state transitions.
  Entities, value objects, domain events, domain services, use cases, commands,
  queries, DTOs, errors, mappers, ports, and adapters each have one focused
  class in a role-named file when that role is needed.
- If no aggregate is needed, the implementation records that explicit absence
  and identifies the consistency boundary instead of inventing one.
- Invariants belong in the aggregate or domain service; application code
  coordinates; adapters translate and persist; composition wires dependencies.

## Dependency direction and file rules

```text
composition -> adapters -> application -> domain
                         -> versioned contracts
```

- Domain imports no NestJS, GraphQL, ORM, transport, adapter, or other
  bounded-context internals. Application imports domain, abstract ports, and
  only the named `Inject` and `Injectable` primitives from `@nestjs/common`;
  it never imports concrete infrastructure.
- Production files have one primary responsibility and do not colocate
  classes, interfaces, type aliases, enums, functions, or runtime constants
  belonging to another role. Names describe the role and bounded context.
- Ports are abstract classes. Adapters implement ports at the outer boundary.
  Application use cases may use `@Injectable()` on the class and `@Inject()`
  on constructor parameters so NestJS can wire those abstract ports. Domain
  remains undecorated. Controllers, resolvers, modules, configuration,
  persistence, transport, GraphQL, vendor SDKs, and concrete adapters remain
  outside Application.

## Narrow exceptions

Only dedicated outer-layer files may use functional artifacts required by
Node.js or NestJS: bootstrap entry points, custom decorators, generated code,
migrations, and barrels. The exception is explicit and auditable; it never
applies to domain, application, service, controller, resolver, provider, or
module classes, and it never permits mixing architectural layers.

The repository inventory covers every project-owned path. Only
`apps/order-workflow-subgraph` and `apps/payment-federation` are excluded from
this migration. Dependencies, caches, generated sources, and build outputs are
ignored explicitly and are not counted as migrated source.

The scanner classifies each in-scope production file by bounded context and by
domain, application, infrastructure, presentation, composition, or an explicit
technical boundary. A source file under a business context that has no approved
layer is a violation; an absent `domain` or `application` directory can never
turn that result into a false zero.

### T-216 implementation record

- Bounded context: repository architecture governance, a technical boundary.
- Use case: inventory and classify every project-owned path before applying the
  architecture rules.
- Aggregate: none; this is deterministic repository analysis, not a business
  state transition.
- Invariants: exactly two application exclusions; ignored paths are never
  source; every in-scope production file has a context and approved layer or
  technical boundary.
- Consistency boundary: one filesystem snapshot rooted at the repository.
- Affected ports: none; the scanner reads the local filesystem directly.
- Red evidence: the focused AC-260 and AC-261 tests failed because the previous
  policy exposed neither a repository inventory nor an unclassified-production
  violation, and it protected only Order Workflow in task manifests.

### T-224 implementation record

- Bounded context: repository architecture governance, a technical boundary.
- Use case: close the migration baseline and publish repository-wide evidence.
- Aggregate: none; the operation classifies and verifies a filesystem snapshot
  and does not perform a business state transition.
- Invariants: the two excluded application roots remain unchanged; every other
  production source has a context and a layer or explicit technical boundary;
  the legacy baseline is empty; unknown production paths still fail closed.
- Consistency boundary: one repository snapshot covered by the architecture and
  quality gates.
- Affected ports: none; the scanner reads the local filesystem directly.
- Red evidence: the focused AC-259, AC-261, and AC-269 test reported all 25
  remaining baseline entries when it first required an empty baseline and zero
  repository violations.
- Classification decision: inspection found that all 25 files are outer-layer
  NestJS composition or presentation shells, vendor infrastructure adapters,
  configuration/declaration artifacts, or compatibility exports created or
  retained by the completed migration waves. The architecture policy assigns
  every one an exact boundary; it adds no directory wildcard, so an unknown
  sibling remains an `unclassified-production` violation.

### T-225 implementation record

- Bounded context: repository architecture governance, a technical boundary.
- Use case: classify approved NestJS injection in Application without allowing
  outer concerns into the layer.
- Aggregate: none; the scanner evaluates source structure, not business state.
- Invariants: Domain has no NestJS dependency; Application may use only
  `Inject` and `Injectable` from `@nestjs/common`; transport, persistence,
  configuration, GraphQL, vendor SDKs, and concrete adapters stay outside.
- Consistency boundary: one scanner evaluation of one repository snapshot.
- Affected ports: none.
- Red evidence: AC-270 rejected the approved `@Injectable()` and constructor
  `@Inject()` usage; AC-271 showed that Express and Better Auth imports were
  not yet classified as outer dependencies.

## Required evidence

Every change follows Red, Green, Refactor when production behavior changes.
Unit tests cover domain and application rules; integration tests cover adapter
and persistence wiring; contract tests cover public GraphQL, HTTP, SSE, OAuth,
messaging, and persistence compatibility; relevant end-to-end tests cover
cross-context behavior. Architecture tests enforce the dependency and file
rules. A change is incomplete while any applicable layer or quality gate is
red.

Before implementation, the task notes must state: bounded context, use case,
aggregate or explicit absence, invariants, consistency boundary, and affected
ports. No agent may omit or silently weaken these decisions.
