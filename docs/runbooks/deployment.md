# Deployment runbook

Deployment runs only from an approved, credentialed environment. The first
external deployment is a reviewed, credentialed `sandbox` deployment.
Its exact stage must not be `production`; both infrastructure scripts reject the
protected production stage. Never call `sst deploy` directly. The guarded package
script is the only approved provisioning entry point.

## Preconditions

- Use short-lived AWS credentials for the approved account in `us-east-1`.
- Start from the Git revision that passed the credential-free quality gate and
  keep the working tree unchanged between review and deployment.
- Set `OAuthSigningSecret`, `WordPressApplicationPassword`,
  `WordPressConsumerKey`, `WordPressConsumerSecret`,
  `MercadoPagoAccessToken`, and `MercadoPagoWebhookSecret` for the exact SST
  stage through the approved secret store and `sst secret set`. Do not place a
  secret value in this repository, command output, diff evidence, or approval.
  Operators must never commit credentials or generated secret-bearing state.
- Record the AWS account ID separately from public evidence. The account ID and
  credentials are not approval tokens.

Copy `.env.example` to the ignored root `.env` and fill it locally. Load it in
the shell that will run SST; Fish users should invoke the Bash subshell form so
the dotenv assignments are interpreted correctly. Never print the resulting
environment.

```sh
# Bash
set -a
source ../.env
set +a

# Fish terminal: run the SST command inside a Bash subshell
bash -lc 'set -a; source ../.env; set +a; corepack pnpm run validate'
```

```sh
cd infra
export SST_STAGE=sandbox
corepack pnpm run validate
```

Missing SST secrets fail closed when the stack evaluates their values. Payment
Federation is configured only with `PAYMENT_PROVIDER_MODE=mercado-pago`; its ECS
healthcheck cannot pass if required Mercado Pago configuration prevents the
application from starting.

## Generate and review the exact diff

The review command runs `sst diff` for `SST_STAGE`, writes the complete diff to
the terminal, and prints its SHA-256 digest as the final line. It does not
provision resources.

```sh
corepack pnpm run review
```

Before granting explicit approval, record all of the following with the change
request:

1. Exact stage, Git revision, AWS account, and `us-east-1` region.
2. Every create, update, replacement, and deletion in the generated diff.
3. Estimated monthly cost and an approved maximum, including the VPC NAT
   instance, ECS/Fargate services, RDS PostgreSQL for Payment, Aurora PostgreSQL
   for Identity and Order Workflow, Aurora MySQL for WordPress, storage, data
   transfer, and the API Gateway HTTP API.
4. One API Gateway HTTPS endpoint exposes Gateway by default, OAuth under
   `/api/auth`, Apollo MCP under `/mcp`, and only the exact Mercado Pago webhook
   path `/webhooks/mercado-pago`. RabbitMQ, WordPress, databases, and all ECS
   services remain private behind Cloud Map and the VPC link.
5. Secret bindings. Mercado Pago access-token and webhook-secret resources bind
   only to Payment Federation; secret values must not appear in the diff.
6. Healthcheck paths and rollback owner. Payment Federation uses
   `/actuator/health`; the Node services use `/ready`; Apollo MCP uses `/health`.

Any source, configuration, credential, account, stage, or infrastructure change
invalidates the review. Run the review command again and approve the new digest.

## Approve and deploy

After the reviewer approves the exact stage, SHA-256 diff, estimated monthly cost,
public endpoints, and secret bindings, export the approval values in the same
credentialed shell. `SST_DEPLOY_APPROVAL=DEPLOY` is the explicit approval signal.

```sh
export SST_APPROVED_STAGE="$SST_STAGE"
export SST_APPROVED_DIFF_SHA256=<reviewed-64-character-digest>
export SST_APPROVED_MONTHLY_COST_USD=<approved-cost-ceiling>
export SST_DEPLOY_APPROVAL=DEPLOY
corepack pnpm run deploy
```

The deploy command reruns the credential-free infrastructure validation, then
recalculates and displays the diff immediately before provisioning. It exits
before `sst deploy` unless the stage is non-production, all approval fields are
present, validation passes, and the recalculated SHA-256 matches the reviewed
digest exactly.

## Recovery

If a critical smoke check fails, stop provider verification, preserve redacted
logs, check out the last approved Git revision, generate and approve its exact
stage diff through this same procedure, and deploy it with the guarded command.
Rotate a secret through the approved store if exposure is suspected; never copy
the old or replacement value into rollback evidence.
