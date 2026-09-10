# Design: Standardize error messages

## Decision

Keep message catalogs local to the bounded context and architectural layer that
owns the failure. TypeScript catalogs use named immutable constants (and named
formatters only when runtime details are required). Java catalogs use package-
owned enums or final constant classes with the same limited formatting rule.

A repository policy test rejects production `throw new` expressions whose
effective message is empty or whose message is an inline string/template
literal. Focused behavior tests continue to protect exact public text.

## Dependency direction

Catalogs live beside their consumers so Domain never imports Application or
Infrastructure and no business context imports another context's catalog. The
change adds no shared runtime dependency and changes no transport mapping.

## Scope boundary

The recommended scan covers deployable TypeScript sources and Java `src/main`.
Tests, fixtures, generated sources, migrations, scripts, and E2E diagnostics are
excluded because their thrown errors are assertion/setup diagnostics rather
than application error contracts. Q-027 records the pending product decision.

## Verification

Seven disjoint implementation tasks first add their own context-specific
failing assertion, then migrate only that context, and run in parallel in clean
Codex contexts. A final sequential governance task adds the shared repository
scanner after those lanes merge. The repository then runs unit/integration
tests, coverage, typecheck, lint, `onp-spec verify`, and
`onp-spec audit --ci`.
