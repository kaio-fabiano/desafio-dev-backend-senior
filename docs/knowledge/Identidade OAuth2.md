---
tags: [oauth2, oidc, better-auth, authorization]
updated: 2026-08-25
---

# OAuth2 Identity

Return to [[Mapa do Projeto]]. Supports [[GraphQL Federation]] and [[Apollo MCP]].

- Better Auth is the Authorization Server, not merely a login library.
- The gateway and MCP are resource servers and validate `iss`, `aud`, time, and
  scopes.
- `me` is derived from `sub`, never from a `userId` sent by the client.
- Registration creates `email` and `wordpress` accounts with
  compensation/reconciliation.
- The same JWT will be bound to the gateway and MCP with repeated RFC 8707
  `resource` parameters; the PoC demonstrates interoperability of the pinned
  versions.

Details: [Identity PRD](../prds/03-identidade-e-oauth.md).
