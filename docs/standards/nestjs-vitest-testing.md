# NestJS and Vitest testing standard

This document is the testing contract for the repository's NestJS and
TypeScript code. Tests protect observable behavior, remain strongly typed, and
run at the smallest layer capable of proving the requirement.

## Test-driven development

Every task that changes production behavior follows this sequence:

1. **Red:** add a focused behavioral test and record its expected Red failure.
2. **Green:** add the minimum Green implementation that satisfies the test.
3. **Refactor:** improve names and structure while the relevant suite stays green.
4. Run unit and integration tests, coverage, typecheck, and lint.
5. Run `onp-spec verify <feature>` and `onp-spec audit --ci`.

A failing test caused by syntax, imports, or broken fixtures is not valid Red
evidence. It must fail because the required behavior is absent or incorrect.

## Test taxonomy and names

- `*.spec.ts`: isolated unit tests.
- `*.integration.spec.ts`: collaboration with real in-process adapters or
  infrastructure substitutes, without public end-to-end startup.
- `*.contract.spec.ts`: schemas, protocols, serialization, and federation
  compatibility.
- `*.e2e-spec.ts`: behavior through deployed or containerized public boundaries.

Unit, integration, contract, and end-to-end tests are complementary. Structural
source inspection may enforce architecture rules but cannot substitute for
behavioral tests.

## Choose the smallest useful test boundary

Use pure unit tests for pure functions, simple services, factories, adapters,
data sources, and helpers. Instantiate the subject directly when the NestJS
container is not part of its behavior.

Use `Test.createTestingModule()` when dependency-injection metadata, a custom
token, a dynamic module, a guard, an interceptor, a pipe, or provider wiring is
part of the contract. Do not test NestJS itself or use `TestingModule` merely
because a class belongs to a NestJS application.

Controllers and GraphQL resolvers receive mocked services or use cases and are
tested through their parameters, delegation, returned values, and meaningful
errors. A unit test does not start a GraphQL or HTTP server.

## Assertions and isolation

Use Vitest consistently:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
```

Follow Arrange, Act, Assert through natural whitespace. Assert observable
results and interactions that form part of the contract. Do not test private
methods, incidental call order, or framework implementation details. Prefer
explicit assertions over snapshots for ordinary objects.

Every test runs independently and may not rely on execution order, an external
network, shared mutable process state, or credentials. Control the clock,
filesystem, HTTP, database, queue, OAuth, WordPress, and Mercado Pago boundaries
when they affect a unit test.

## Typed mocks

Prefer dependency injection and `useValue` for NestJS providers. Reserve
`vi.mock()` for external modules, static SDK entry points, or global APIs that
do not have an injectable boundary.

Mocks derive their signatures from production contracts:

```ts
const verify = vi.fn<TokenVerifierService['verify']>();
const dependency = { verify } satisfies Pick<TokenVerifierService, 'verify'>;
```

Do not use `any`, mock the subject under test, or mock pure value objects and
helpers. Add an automatic-mocking library only after repeated code demonstrates
a concrete benefit.

## GraphQL execution contexts

GraphQL guard tests share one typed helper that produces an `ExecutionContext`
compatible with `GqlExecutionContext.create()`. Do not duplicate large context
mocks across files. The helper remains test-only and exposes only the context
state relevant to callers.

## Coverage gates

Coverage is measured per production file for every reviewed NestJS library:

| Metric | General floor | Critical floor |
| --- | ---: | ---: |
| Lines | 90% | 100% |
| Statements | 90% | 100% |
| Functions | 90% | 100% |
| Branches | 85% | 95% |

Authentication, authorization, ownership, idempotency, and equivalent security
or consistency boundaries are critical. Entry-point barrels, type-only files,
generated code, and migrations may be excluded explicitly. Exclusions may not
hide executable production behavior. Coverage is enabled incrementally for a
library when its folder review begins, but its configured floor is never
lowered to accommodate missing tests.

Coverage measures execution, not test quality. Every bug fix also requires a
regression test, and meaningful happy paths, failures, limits, and authorization
decisions remain mandatory even after the numerical threshold is met.

## Delivery report

Every completed review reports changed files, tests added or refactored,
problems found, decisions made, critical scenario coverage, and remaining
TODOs. Ambiguous business behavior is preserved and recorded for review rather
than changed silently.
