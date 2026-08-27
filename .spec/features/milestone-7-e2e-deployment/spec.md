# Spec: Milestone 7 — E2E, quality, and deployment

> feature: milestone-7-e2e-deployment
> status: pronta

## Context

The implemented vertical slices still need one reproducible delivery gate that starts the complete system from zero, proves the mandatory buyer journeys, measures the critical quality requirements, and provides a reviewable SST deployment path.

## User stories

### US-037 — Reproduce the complete marketplace journey

As an evaluator, I want one isolated command to start every dependency and exercise the public Gateway and MCP interfaces, so that the delivered architecture is proven rather than inferred from component tests.

#### AC-067 — The complete environment and journey run from one command

- **Dado** a clean machine with Docker and the repository dependencies installed
- **Quando** the Milestone 7 acceptance target runs
- **Então** Testcontainers starts the required databases, RabbitMQ, WordPress, Gateway, subgraphs, workers, payment processor, and Apollo MCP, waits for readiness, runs the journey, and always tears the environment down

#### AC-068 — Registration and OAuth identity are proven end to end

- **Dado** seeded OAuth clients and a clean identity and WordPress state
- **Quando** the journey registers a buyer and obtains a scoped multi-resource token
- **Então** the buyer has email and WordPress account links and the token is accepted by both the Gateway and Apollo MCP

#### AC-069 — Card checkout reaches the same terminal state everywhere

- **Dado** an authenticated buyer, a seeded product, and a subscription opened before checkout
- **Quando** the buyer adds the product, checks out by Card, and retries the same operation key
- **Então** one order and one charge exist and the subscription, federated `me` query, and persisted order all report the approved terminal state

#### AC-070 — Pix checkout reaches the same terminal state everywhere

- **Dado** an authenticated buyer, a seeded product, and a subscription opened before checkout
- **Quando** the buyer checks out by Pix
- **Então** the subscription and federated `me` query report the generated terminal state and the same stable Pix code

#### AC-071 — MCP parity and rejection are proven through the protocol

- **Dado** the same buyer fixtures and token used by the GraphQL journey
- **Quando** an MCP client invokes the curated tools and then retries without a token, with the wrong audience, and without the required scope
- **Então** `me` matches the direct GraphQL result exactly and every invalid request is rejected

### US-038 — Enforce measurable delivery quality

As a maintainer, I want coverage, performance, batching, Nx, and container gates in CI, so that regressions are visible before deployment.

#### AC-072 — Critical domains meet the coverage floor

- **Dado** the order and payment domain test suites
- **Quando** CI collects coverage
- **Então** each critical domain reports at least 70 percent line coverage and the command fails below the threshold

#### AC-073 — Gateway latency and batching meet their budgets

- **Dado** deterministic local fixtures and a warmed Gateway
- **Quando** the load probe queries the federated buyer journey
- **Então** measured P95 latency is below 500 milliseconds and request counters prove product and order entity loads are batched rather than executed per item

#### AC-074 — Nx provides one cached cross-language task graph

- **Dado** the Node and Java projects in the monorepo
- **Quando** build, test, and affected targets run twice
- **Então** Nx recognizes both runtimes, honors target dependencies, and serves eligible repeated work from the local or CI cache without a custom TUI

#### AC-075 — Production containers are complete and operable

- **Dado** the final Compose topology
- **Quando** images are built and the environment starts
- **Então** every application uses a pinned multi-stage image, runs as a non-root user where supported, exposes a real healthcheck, and becomes ready without manual steps

### US-039 — Review and deploy the infrastructure safely

As an operator, I want versioned SST infrastructure and complete runbooks, so that a reviewer can inspect changes and deploy without console-only steps or committed secrets.

#### AC-076 — SST changes are reproducible and secret-safe

- **Dado** a named stage and no secrets committed to the repository
- **Quando** CI runs the infrastructure validation and `sst diff`
- **Então** the pinned SST v3 stack describes the application resources, emits a reviewable plan, and reserves `sst deploy` for an approved credentialed environment

#### AC-077 — Every required deliverable has executable evidence

- **Dado** the challenge requirements and the completed system
- **Quando** a reviewer follows the root documentation
- **Então** the requirement matrix links each mandatory item to its spec criterion, automated proof, runbook, primary operation collection, or MCP Inspector evidence location

## Out of scope

- A custom TUI; Nx dynamic output, Nx Console, and `nx graph` already cover the operator workflow.
- OpenTelemetry, which is an optional bonus and can be specified after the mandatory delivery gate is complete.
- Performing a paid or production AWS deployment without explicit user authorization and credentials.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-026 | The CI runner is Linux with Docker available for Testcontainers. | confirmada | The existing GitHub Actions workflow uses an Ubuntu runner and Docker-backed proofs. |
| ASM-027 | Deterministic local load fixtures are sufficient for the required local P95 budget. | confirmada | RNF10 explicitly defines the measurement as local load. |
| ASM-028 | OpenTelemetry can follow as a separate bonus feature without blocking mandatory acceptance. | confirmada | README sections 13 and 18.7 mark it optional/bonus. |

## Perguntas em aberto

| ID | Question | Status | Answer |
|---|---|---|---|
| Q-001 | Should this milestone stop at tested SST validation/diff, or also perform a real AWS deployment that may create billable resources? | respondida | Stop at tested SST validation and `sst diff`; do not create AWS resources without a separate explicit authorization. |
