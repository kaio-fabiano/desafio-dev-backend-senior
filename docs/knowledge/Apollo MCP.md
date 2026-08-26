---
tags: [mcp, graphql, oauth2, agents]
updated: 2026-08-25
---

# Apollo MCP

Return to [[Mapa do Projeto]]. Uses [[Identidade OAuth2]] and consumes only the
supergraph from [[GraphQL Federation]].

Tools are registered and curated operations. The bearer token is validated in
the MCP and propagated to the gateway; there is no parallel identity or
administrative bypass. `me` via tool and via GraphQL must return the same
object.

Details: [Apollo MCP PRD](../prds/05-apollo-mcp.md).
