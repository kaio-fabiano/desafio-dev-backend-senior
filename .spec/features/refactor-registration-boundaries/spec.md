# Spec: Refactor registration boundaries

> feature: refactor-registration-boundaries
> status: auditada

## Context

The identity registration implementation currently combines Better Auth hook
orchestration, WooCommerce configuration and HTTP access, Nest provider wiring,
and compensating cleanup in one source file. The refactor must expose those
responsibilities as focused NestJS providers suitable for a senior-level code
presentation while preserving the supported registration contract.

## Stories

### US-112 — Present registration through explicit architectural boundaries

As a maintainer, I want registration responsibilities separated by ownership so
that the identity flow is readable, independently testable, and safe to evolve.

#### AC-233 — Separate registration concerns into focused NestJS providers

- **Dado** the current email registration flow
- **Quando** the registration architecture is inspected and its providers are resolved
- **Então** registration orchestration, WooCommerce HTTP/configuration, and rollback each have an explicit focused NestJS owner composed by the auth module.

#### AC-234 — Preserve successful registration behavior

- **Dado** a successful Better Auth email signup and an available WooCommerce customer API
- **Quando** the registration hook completes
- **Então** the customer is created, the WordPress account is linked, and the Better Auth subject is attached exactly as before the refactor.

#### AC-235 — Preserve compensating cleanup behavior

- **Dado** registration fails after one or more external or identity effects
- **Quando** compensation runs
- **Então** only resources owned by that attempt are cleaned up, independent cleanup steps continue after failures, and typed failure details are retained.

#### AC-236 — Compose authentication through focused NestJS modules

- **Dado** the Better Auth, registration, and WordPress capabilities
- **Quando** the identity authentication module graph is inspected and resolved
- **Então** each capability owns a focused NestJS module, cross-capability providers are exported explicitly, and the existing registration behavior remains unchanged.

### US-113 — Align identity integration with the GraphQL-first module architecture

As a maintainer, I want identity registration to use the native WordPress
GraphQL boundary and feature-owned NestJS modules so that protocol, naming, and
code ownership communicate the same architecture.

#### AC-237 — Prove the native WordPress GraphQL registration contract

- **Dado** the pinned WPGraphQL and GraphQL for eCommerce versions
- **Quando** the registration capabilities are inspected against the running WordPress schema
- **Então** customer creation, Better Auth subject linking, and compensating deletion are documented as native GraphQL operations or as an explicitly identified capability gap before production integration changes.

#### AC-238 — Use GraphQL for WordPress identity registration

- **Dado** an email registration attempt
- **Quando** WordPress customer creation, subject linking, or compensation is executed
- **Então** the identity runtime calls the WordPress `/graphql` boundary with named operations and never calls the WooCommerce REST customer endpoint.

#### AC-239 — Organize identity authentication by NestJS feature ownership

- **Dado** the identity NestJS source tree
- **Quando** its authentication providers and imports are inspected
- **Então** Better Auth, OAuth, registration, and WordPress each live in a named feature folder with its owning module, and no generic `auth` folder remains as a mixed-responsibility container.

#### AC-240 — Keep errors and public providers owned by their feature

- **Dado** Better Auth, OAuth, registration, and WordPress failures and providers
- **Quando** their declarations and exports are inspected
- **Então** each error code belongs to its responsible feature, OAuth resource policy belongs to OAuth, and existing application entry points resolve the renamed providers without changing public authentication behavior.

### US-115 — Distinguish the OAuth issuer from shared resource-server verification

As a maintainer, I want OAuth naming to expose protocol roles so that the
Identity authorization server cannot be confused with the reusable resource
server support in Platform.

#### AC-244 — Name OAuth components by their protocol responsibility

- **Dado** Identity provisions OAuth clients while Platform verifies access tokens
- **Quando** the NestJS module graph and application bootstrap are inspected
- **Então** Identity owns an explicitly named OAuth issuer module and client provisioning service, Platform retains the distinct OAuth resource module, and application startup contains no redundant service lookup.

## Scope constraints

- Preserve the public Better Auth route, API error code, provider identifier,
  bootstrap bypass, and registration behavior.
- Use the native WordPress `/graphql` endpoint for identity registration. Do
  not call `/wp-json/wc/v3/customers` from the identity runtime.
- Prefer the pinned plugins' native mutations. If the proof identifies a
  missing operation, add only the smallest private WordPress GraphQL extension
  required for atomic provisioning or compensation; do not duplicate the
  WooCommerce schema.
- Use `ConfigService` at the infrastructure composition boundary instead of
  reading `process.env` inside application code.
- Keep Better Auth as the sole identity store and WooCommerce as the customer
  authority.
- Follow the existing NestJS feature-folder structure; do not introduce DDD,
  Clean Architecture layers, gateways, ports, or generic abstractions.
- Do not add a second persistence model, workflow engine, or event bus.

## Out of scope

- Changing service-to-service TLS or deployment networking.
- Adding distributed idempotency or reconciliation persistence.
- Changing signup conflict semantics or user-visible API responses.

## Suposições

| ID      | Assumption                                                                                                                  | Status     | Resolution                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| ASM-076 | The refactor preserves externally observable behavior and changes only internal ownership boundaries.                       | confirmada | The requested change is architectural decomposition of the existing registration flow.       |
| ASM-077 | Better Auth, registration, and WordPress require explicit NestJS module boundaries rather than folder-only grouping.        | confirmada | The user explicitly required modules after reviewing the folder-only proposal on 2026-09-05. |
| ASM-078 | GraphQL is the required protocol boundary for all WordPress identity registration operations.                               | confirmada | The user explicitly confirmed the GraphQL-only direction on 2026-09-05.                      |
| ASM-079 | Better Auth, OAuth, registration, and WordPress are separate NestJS features rather than children of a generic auth folder. | confirmada | The user identified the mixed `auth` folder and approved the proposed feature-module split.  |

## Perguntas em aberto

| ID    | Question                                                                                                  | Status     | Answer                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Q-014 | Which model, effort, and parallel execution choice should be fixed in the execution plan?                 | respondida | The user approved gpt-5.6-sol with high effort for T-191 through T-193 and sequential execution on 2026-09-05. |
| Q-015 | Which model and effort should be used for the module-boundary reorganization?                             | respondida | The user approved gpt-5.6-sol with high effort and sequential execution on 2026-09-05.                         |
| Q-016 | Which model, effort, and execution order should be used for the GraphQL migration and final module split? | respondida | The user approved gpt-5.6-sol with high effort and sequential execution for T-195 through T-199 on 2026-09-05. |
