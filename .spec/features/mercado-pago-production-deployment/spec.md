# Spec: Mercado Pago production deployment

> feature: mercado-pago-production-deployment
> status: rascunho

## Context

The repository proves Mercado Pago behavior with isolated contract tests, while
the complete E2E journey still selects the deterministic provider and the SST
stack does not inject Mercado Pago secrets into Payment Federation. This
delivery must prove the complete credential-free system, exercise the real
Mercado Pago test environment when credentials are supplied, and deploy a
reviewed stage without committing secrets or silently falling back to fake
payments.

## User stories

### US-094 — Prove the complete system before deployment

As an operator, I want one repeatable quality gate for the whole repository, so
that regressions are found before billable infrastructure or provider calls are
made.

#### AC-187 — The complete credential-free gate passes

- **Dado** a clean checkout with Node, Docker, and repository dependencies available
- **Quando** the full test, build, lint, typecheck, coverage, container, and E2E gates run
- **Então** every required check passes without skipped tests and produces reviewable evidence for the exact Git revision

#### AC-188 — Payment-critical behavior remains covered

- **Dado** Card, Pix, webhook, idempotency, timeout recovery, and refund scenarios
- **Quando** Payment Federation tests run with the remote client isolated
- **Então** each scenario proves its domain and provider boundary outcome without handling raw card data or requiring a real credential

### US-095 — Exercise Mercado Pago safely

As an operator, I want an automated test-environment verification, so that the
real provider integration is demonstrated without exposing credentials or
creating uncontrolled duplicate payments.

#### AC-189 — Real test payments are idempotent and redacted

- **Dado** approved Mercado Pago test credentials and unique recorded operation keys
- **Quando** Card and Pix test payments are submitted and retried
- **Então** one provider payment exists per operation key and the evidence contains only timestamps, sanitized references, statuses, and exit results

#### AC-190 — Webhook and refund convergence is verified

- **Dado** a provider test payment and a public HTTPS callback for the deployed stage
- **Quando** signed notifications are delivered, replayed, and an approved Card payment is refunded twice with the same operation key
- **Então** invalid notifications are rejected, valid repetitions cause one transition, and one authoritative refund reaches the local state

### US-096 — Deploy a real-payment stage safely

As an operator, I want the complete runtime deployed with secret-backed Mercado
Pago configuration, so that the public application uses the real provider and
can be verified and rolled back.

#### AC-191 — Infrastructure fails closed and contains the complete runtime

- **Dado** a non-local SST stage configured for real payments
- **Quando** the infrastructure is validated and diffed
- **Então** every required application and dependency is represented, Mercado Pago configuration comes from managed secrets, and missing configuration prevents Payment Federation from becoming ready

#### AC-192 — Deployment is reviewed before provisioning

- **Dado** approved AWS credentials and a named non-production stage, with either a generated infrastructure diff or an explicitly approved clean Git revision when SST v3 reports that the stage does not exist
- **Quando** the operator reviews the resources, estimated cost exposure, public endpoints, and secret bindings
- **Então** deployment runs only after explicit approval for that exact stage and diff, or for the exact clean revision during its first creation

#### AC-193 — Post-deploy smoke tests prove and preserve the release

- **Dado** a successfully deployed stage with its public Gateway, MCP, webhook, and health endpoints
- **Quando** health, authentication, Card, Pix, webhook, idempotency, and refund smoke tests run
- **Então** the release evidence identifies the deployed revision and stage, secrets remain redacted, and rollback instructions are executable if any critical check fails

### US-098 — Expose the sandbox securely without a custom domain

As an operator without a registered domain, I want one managed HTTPS entry point,
so that OAuth, GraphQL, MCP, and Mercado Pago webhooks are reachable without
permanent load-balancer costs or a purchased DNS name.

#### AC-195 — One API Gateway exposes only the approved public routes

- **Dado** the private ECS services and their Cloud Map registrations
- **Quando** the SST sandbox infrastructure is evaluated
- **Então** one API Gateway HTTP API routes OAuth, Gateway, MCP, health, and the exact Mercado Pago webhook path over its managed HTTPS URL without service-owned load balancers

## Out of scope

- Production customer traffic or live customer cards.
- Committing AWS or Mercado Pago credentials, tokens, webhook signatures, or raw provider payloads.
- Deploying to the protected `production` stage during the first verification.
- Recurring payments, installments, split payments, chargebacks, and disputes.

## Suposições

| ID      | Assumption                                                                                                                                       | Status     | Resolution                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------- |
| ASM-067 | The first external deployment should use an isolated non-production stage and Mercado Pago test credentials.                                     | confirmada | The owner approved the recommended `sandbox` stage.                             |
| ASM-068 | AWS remains the deployment target because the repository already contains an SST v3 AWS stack.                                                   | confirmada | The owner approved the recommended SST/AWS deployment path.                     |
| ASM-069 | Provider test payments may be created and refunded as part of verification, provided every operation is uniquely keyed and evidence is redacted. | confirmada | The owner authorized test transactions, refunds, and a temporary HTTPS webhook. |
| ASM-070 | A managed AWS HTTPS endpoint is preferable to purchasing and operating a custom domain for the sandbox.                                            | confirmada | The owner declined a domain and approved the API Gateway design.                                                   |

## Perguntas em aberto

| ID    | Question                                                                                                                                                       | Status     | Answer                                                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-009 | Which exact SST stage name and AWS account/region should receive the first deployment?                                                                         | respondida | Use stage `sandbox` in the stack's configured `us-east-1` region; the AWS account will be resolved from credentials before diff or deployment.              |
| Q-010 | Are the AWS credentials, Mercado Pago test access token, and webhook secret already available through the local credential helper or an approved secret store? | respondida | No relevant credentials are present in the current process environment; external verification and provisioning must wait for approved credential injection. |
| Q-011 | May the verification create and refund Mercado Pago test transactions and expose a temporary public webhook endpoint?                                          | respondida | Yes, for test transactions only, with unique operation keys and redacted evidence.                                                                          |
