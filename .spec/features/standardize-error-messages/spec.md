# Spec: Standardize error messages

> feature: standardize-error-messages
> status: pronta

## Context

Production code currently throws inline string literals and, in several paths,
exceptions without messages. This makes the error vocabulary difficult to
discover, review, and keep consistent across the TypeScript/NestJS and
Java/Spring bounded contexts.

The repository already has the preferred shape in
`OAuthAuthenticationMessages`: a context-owned named catalog referenced by
throw sites. This feature extends that pattern without creating a global
cross-context catalog and without changing existing public error text.

## Stories

### US-139 — Maintain one discoverable error vocabulary per context

As a maintainer, I want every production exception message to come from a
named, context-owned catalog so that errors are documented, consistent, and
safe to change.

#### AC-298 — TypeScript throw sites use named messages

- **Dado** the production TypeScript sources in the Gateway, Identity, and Platform boundaries
- **Quando** the error-message policy scans exception construction
- **Então** every new exception has a non-empty message obtained from a context-owned constant, enum entry, or named catalog formatter
- **E** no throw site contains an inline message literal

#### AC-299 — Java throw sites use named messages

- **Dado** the Java production sources in the Transaction, Inventory, Payment, and Shared boundaries
- **Quando** the error-message policy scans exception construction
- **Então** every new exception has a non-empty message obtained from a package-owned constant, enum entry, or named catalog formatter
- **E** no throw site contains an inline message literal

#### AC-300 — Custom exceptions provide documented messages

- **Dado** a custom exception that callers may construct without arguments
- **Quando** the exception is created
- **Então** its constructor supplies a non-empty message from its owning error catalog

#### AC-301 — Existing observable error text remains compatible

- **Dado** an existing API, GraphQL, OAuth, payment, or infrastructure failure with a message
- **Quando** its throw site is migrated to the named catalog
- **Então** callers observe the same message text and dynamic details as before the migration

#### AC-302 — Future regressions fail the quality gate

- **Dado** a production throw site with an inline literal or no effective message
- **Quando** the repository error-message governance test runs
- **Então** the test reports the file and line and fails

## Out of scope

- Changing exception types, HTTP or GraphQL status codes, error codes, or retry behavior.
- Translating existing English error text.
- Introducing one global error catalog shared by unrelated bounded contexts.
- Test fixtures, test-only diagnostics, generated sources, migrations, and E2E harness code, pending Q-027.

## Suposições

Nenhuma.

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-027 | Should “all project errors” cover production sources only (recommended), or also test fixtures, test-only diagnostics, scripts, and the E2E harness? | respondida | Production sources only. Tests, fixtures, scripts, generated sources, migrations, and the E2E harness remain outside this standardization. |
