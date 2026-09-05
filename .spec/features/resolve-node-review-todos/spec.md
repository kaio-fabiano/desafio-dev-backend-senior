# Spec: Resolve Node review findings

> feature: resolve-node-review-todos
> status: auditada

## Context

Resolve every open Node code review marker in the current user working tree. inventory.json preserves the original marker location and wording. Findings are review questions until verified; a question may close with a source-backed no-change decision, while a confirmed defect requires regression coverage. Parser-required Portuguese keywords are retained; authored prose is English.

## Stories

### US-111 — Close the Node review with verified corrections

As a maintainer, I want every review finding resolved with evidence so the supported Node services remain secure, maintainable and executable.

#### AC-225 — Prepare decorator runtime, test ownership and coverage

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** All reviewed app startup, build and test commands load decorator syntax; identity owned tests affect Nx cache hashes; existing coverage floors are preserved.

#### AC-226 — Resolve gateway authentication, federation and loader findings

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** Invalid credentials fail closed while internal verification failures remain distinguishable; forwarding uses explicit policies, a cookie allowlist, trusted request URLs and preserves multiple response cookies. Existing private GraphQL behavior remains covered.

#### AC-227 — Resolve Better Auth lifecycle, registration and resource scopes

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** Nest owns auth providers and resource cleanup; signup linking and compensation remain correct under failure; resource scopes match protected operations without widening access.

#### AC-228 — Consolidate identity application, GraphQL and legacy consumers

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** Identity starts through its supported library API; pagination, request-scoped batching and ownership checks preserve results and denial behavior; seed and existing consumers use the maintained implementation.

#### AC-229 — Resolve checkout, command hashing and persistence findings

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** Repeated checkout commands do not duplicate remote orders, conflicting idempotency keys are rejected, invalid inputs never reach WooCommerce and persisted transitions remain atomic.

#### AC-230 — Resolve inbox, outbox, messaging and saga findings

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** Duplicate events apply once; retryable failures remain recoverable; messages are acknowledged only after the required durable work, and shutdown releases messaging resources.

#### AC-231 — Resolve workflow GraphQL, bootstrap and SSE findings

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** GraphQL mutations and subscriptions enforce ownership and scopes, preserve schema and stream protocol, and release replay and subscription resources on disconnect and shutdown.

#### AC-232 — Integrate corrections and close every review finding with evidence

- **Dado** the current reviewed Node implementation and its supported contracts
- **Quando** the relevant focused regression and integration scenarios execute
- **Então** Each inventory finding has a tested correction or a documented evidence-backed no-change decision; all relevant unit/integration, coverage, build, typecheck, lint, spec verification and CI audit gates pass.

## Scope constraints

Preserve public GraphQL schemas, stream protocol and existing private gateway policy. Do not introduce broader authorization, a second identity data owner, speculative enum/file proliferation or weakened tests. No deployment or external messaging is requested.

## Suposições

| ID      | Assumption                                                                                            | Status     | Resolution                                              |
| ------- | ----------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| ASM-075 | Preserve existing business and protocol behavior wherever review questions do not establish a defect. | confirmada | User approved the proposed plan with "y" on 2026-09-05. |

## Perguntas em aberto

| ID    | Question                                                                                               | Status     | Answer                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| Q-013 | Approve the proposed per-task models and efforts with three domain lanes after sequential preparation? | respondida | User approved the concrete table and three parallel domain lanes with "y" on 2026-09-05. |
