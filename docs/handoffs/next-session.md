# Next-session handoff

## Verified baseline

The challenge delivery is merged into the user fork's `main` branch at merge
commit `80006d8`. Pull request
[`#7`](https://github.com/kaio-fabiano/desafio-dev-backend-senior/pull/7)
passed the main CI job and the pinned SST validation. The local acceptance run
passed all six Testcontainers scenarios, and the specification audit proved all
141 acceptance criteria without warnings.

This baseline proves the challenge delivery. It does not prove a Mercado Pago
sandbox transaction, a cloud deployment, or production readiness.

## Resume here

Use the [production-readiness gap register](../prds/08-riscos-e-decisoes-pendentes.md#production-readiness-gap-register)
as the source of truth. Start a separate specification for each authorized gap;
do not combine the payment, infrastructure, and WordPress decisions into one
migration.

1. **G-001 — Mercado Pago sandbox.** First verify that test credentials, a
   public HTTPS webhook, a managed secret destination, and an authorized test
   account are available. Then follow the
   [Mercado Pago sandbox runbook](../runbooks/mercado-pago-sandbox.md) and record
   redacted Card, Pix, webhook replay, timeout reconciliation, and
   refund evidence. Without those external inputs, G-001 must not be reported
   as closed.
2. **G-002 — Deployment infrastructure.** After the owner supplies the AWS
   account, region, cost envelope, domain/DNS, and deployment credentials,
   decide the managed-versus-self-hosted database and broker topology in an ADR.
   Extend the existing pinned SST graph only after that decision, then prove
   diff, isolated deployment, migrations, smoke tests, and rollback.
3. **G-003 — Production WordPress.** Build the immutable WordPress delivery
   around the infrastructure decision: pinned reviewed plugins, durable database
   and uploads, controlled upgrades, caching, least-privilege credentials,
   provenance/SBOM, backup restore, and rollback evidence.

If G-001 remains externally blocked, record the blocker and ask the owner
whether G-002 discovery is authorized. Do not reinterpret a missing credential
or environment as permission to weaken the acceptance evidence.

## Required execution discipline

- Read the relevant gap row and runbook before creating the feature spec.
- Declare `Modelo:` and `Esforço:` in `tasks.md`, present the execution table,
  and obtain explicit approval before implementation.
- Prefer provider and framework capabilities over custom infrastructure.
- Run ESLint and the affected Nx gates for every TypeScript change.
- Finish with feature verification, `onp-spec audit --ci`, code review, and
  Graphify freshness.
- Push and open pull requests only in
  `kaio-fabiano/desafio-dev-backend-senior`, never in the upstream repository.
