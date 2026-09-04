# Sandbox release smoke test

- Executed: 2026-09-04 UTC
- Stage: `sandbox`
- Public API health: HTTP 200
- Identity JWKS: HTTP 200
- OAuth client discovery: HTTP 200 with both expected clients
- Anonymous GraphQL request: HTTP 401
- Anonymous MCP initialization: HTTP 401
- Unsigned Mercado Pago webhook: HTTP 400 without a state transition
- Mercado Pago provider verification: Card, Pix, invalid signature, idempotent refund, and webhook replay passed
- ECS readiness: all seven services reached their desired task count

No access token, card token, webhook secret, provider identifier, or raw provider payload is stored in this evidence.
