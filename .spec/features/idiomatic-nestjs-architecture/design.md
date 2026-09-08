# Design: Idiomatic NestJS architecture

## Decision

NestJS is the application framework and composition mechanism. Domain remains
framework-free. Application may use the narrow `@nestjs/common` dependency
injection surface (`@Injectable()` and constructor `@Inject()`), while all
transport, configuration, persistence, vendor, and adapter details remain in
outer layers.

## Composition shape

```text
NestJS modules / custom providers
  -> infrastructure and presentation adapters
  -> injectable application use cases
  -> domain policies and values
```

Abstract-class ports remain runtime injection tokens. Stable use cases are
registered directly as providers. `useExisting` aliases concrete adapters to
ports; `useFactory` is reserved for configuration-dependent infrastructure or
objects whose construction actually needs runtime values.

## Context slices

- Identity: inject stable registration, compensation, provisioning, and query
  use cases. Keep hook-derived Better Auth adapter state as explicit input.
- Platform: separate the vendor credential verifier adapter from the injected
  verification use case to avoid self-reference.
- Gateway: inject stable authentication, federation, and subscription use
  cases; construct Apollo data sources through NestJS-owned configuration.
- Governance: make the scanner distinguish Domain from Application and add a
  repository-wide module/composition audit.

## Sequencing

The governance rule and three bounded-context slices can be developed in clean,
file-disjoint worktrees. The repository-wide module audit runs only after those
branches are integrated, then the executor runs verification and CI audit.

## Clean-context execution contract

Each task is dispatched by a separate headless `codex exec` process. The
executor never continues a prior task's chat or transcript. Each fresh session
is seeded only with repository instructions, the feature artifacts, the target
task, and the current worktree files. Dependencies are transferred through
atomic commits and merges, not through conversational memory. Targeted retries
also start a new `codex exec` session.

## Rejected alternatives

- `ModuleRef.get()` service location: hides dependencies and weakens tests.
- A custom DI container or handwritten composition root: duplicates NestJS.
- Request-scoped plumbing for third-party hook internals: adds lifecycle
  complexity where explicit runtime input is clearer.
- Decorators in Domain or transport/vendor types in Application: violates the
  retained DDD boundary.
