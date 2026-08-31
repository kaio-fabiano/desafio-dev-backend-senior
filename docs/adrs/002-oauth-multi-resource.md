# ADR 002 — OAuth multi-resource access token

- Status: accepted
- Date: 2026-08-26
- Proof fixture: `test/fixtures/auth-server.ts`
- Versions: `better-auth@1.7.1`, `@better-auth/oauth-provider@1.7.1`

## Context

The gateway and Apollo MCP are independent OAuth resource servers. The critical
question was whether one Better Auth grant could produce a JWT access token bound
to both resources without either server accepting an unlisted audience or scope.
The 1.7 line is required because it introduced explicit protected resources and
fixed resource widening between authorization and token exchange.

## Experiment

The proof starts Better Auth with its OAuth Provider, JWT, JWKS, and memory adapter.
It seeds two protected resources and one confidential client linked to both. The
client requests one `client_credentials` token with two repeated RFC 8707
`resource` parameters. Separate Better Auth resource clients then validate the
same token with exact issuer, audience, expiration, signature, and
`marketplace:read` scope checks.

The negative path requests a token for only one resource and presents it to the
other. Both directions must fail, even though the token has a valid signature,
issuer, lifetime, and scope. No `allowMissingAudience`, custom audience claim, or
scope fallback is configured.

## Decision

Adopt one JWT access token containing both gateway and MCP audiences when a client
needs both resources. Keep resource linkage at the Better Auth authorization
server and validate each server's exact audience and required scopes independently.
Apollo MCP must keep permissive audience handling disabled and forward the same
bearer token to the gateway, which validates it again.

This proof uses `client_credentials` only to isolate resource binding from browser
interaction. The final delegated-user flow will use Authorization Code with S256
PKCE and the same repeated-resource and resource-server validation rules.

## Reproduction

```bash
corepack pnpm@10.17.1 install --frozen-lockfile
node --experimental-transform-types --test --test-reporter=tap test/marco-0-auth.test.mjs
corepack pnpm@10.17.1 exec nx run @desafio-dev-backend-senior/identity-subgraph:test
```

The test target proves criteria AC-011 and AC-012. The probe prints the verified
claims and both expected audience rejections as JSON.

## Sources

- [Better Auth OAuth 2.1 Provider](https://better-auth.com/docs/plugins/oauth-provider)
- [Better Auth 1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide)
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
