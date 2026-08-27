# Milestone 6 — Authenticated Apollo MCP

## Automated acceptance

Use the repository-managed Node runtime and invoke the Nx target:

```bash
TASK_NODE=/home/kaiosilva/.local/share/fnm/node-versions/v24.19.0/installation/bin/node
PATH="$(dirname "$TASK_NODE"):$PATH" corepack pnpm exec nx run @desafio-dev-backend-senior/poc-harness:milestone-6-acceptance
```

The probe uses the MCP TypeScript SDK over Streamable HTTP. It verifies the allowlist, unavailable tools, OAuth resource rejection, scopes, unchanged authorization forwarding, direct GraphQL `me` parity, and bearer redaction.

## Inspector follow-up evidence

Start the stack with `docker compose up --build`. In MCP Inspector, connect to `http://localhost:8000/mcp` using a short-lived MCP-and-gateway audience token with only the scopes needed for the demonstration. List tools, call `me`, call `searchProducts`, and capture the Inspector UI only after checking that its request/response panes do not show an access token.

Store only redacted screenshots and a timestamped summary in `docs/evidence/mcp/`. Do not commit bearer values, copied authorization headers, token payloads, client credentials, or Inspector export files containing them. Automated protocol tests—not screenshots—remain the release gate.
