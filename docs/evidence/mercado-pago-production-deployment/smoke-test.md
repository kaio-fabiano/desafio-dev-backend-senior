# Sandbox release smoke test

- Executed: `2026-09-04T10:20:24Z`
- Git revision: `9c341b30c17bc42e2df99279b9f1a853b67b64a4`
- Stage: `sandbox`
- Public endpoint: `https://zvc13ty1m4.execute-api.us-east-1.amazonaws.com`
- Public API health: HTTP 200
- Identity JWKS: HTTP 200
- OAuth client discovery: HTTP 200 with both expected clients
- Authenticated GraphQL request: HTTP 200 with the renewed OAuth PKCE bearer
- Anonymous GraphQL request: HTTP 401
- Anonymous MCP initialization: HTTP 401
- Unsigned Mercado Pago webhook: HTTP 400 without a state transition
- Mercado Pago provider verification: Card and Pix retries resolved to one provider payment per operation key
- Invalid signed webhook: HTTP 401 without a local state transition
- Refund convergence: two requests with one operation key produced one provider refund and local `REFUNDED`
- Signed webhook replay: HTTP 200 twice with one authoritative local transition
- ECS readiness: all seven services were `ACTIVE` with desired 1, running 1, and pending 0

No access token, card token, webhook secret, provider identifier, or raw provider payload is stored in this evidence.

## Rollback

If a critical smoke check fails, stop provider verification and run the guarded
rollback from `infra` after the previous revision and its new diff are approved:

```sh
git switch --detach "$LAST_APPROVED_GIT_REV"
cd infra
corepack pnpm run review
export SST_APPROVED_STAGE=sandbox
export SST_APPROVED_DIFF_SHA256="$REVIEWED_DIFF_SHA256"
export SST_APPROVED_MONTHLY_COST_USD="$APPROVED_COST_CEILING"
export SST_DEPLOY_APPROVAL=DEPLOY
corepack pnpm run deploy
```
