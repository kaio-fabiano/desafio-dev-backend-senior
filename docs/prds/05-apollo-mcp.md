# PRD 05 — Authenticated Apollo MCP

## Expected outcome

Agents access a secure subset of the marketplace through Apollo MCP Server. The
server uses OAuth2, forwards the bearer token to the supergraph, and produces
exactly the same view as a direct GraphQL call under the same identity.

## Topologia

```text
MCP client --OAuth bearer--> Apollo MCP --same bearer--> Gateway --> Subgraphs
```

MCP never points to an isolated subgraph and has no administrative bypass. All
rules remain in the gateway/subgraphs; the whitelist reduces the surface area,
but does not replace domain authorization.

## Allowed tools

| Tool             | Behavior                    | Suggested scope    | Mutation? |
| ---------------- | --------------------------- | ------------------ | --------- |
| `me`             | current user                | `marketplace:read` | no        |
| `searchProducts` | paginated product discovery | `marketplace:read` | no        |
| `getProduct`     | product lookup by ID        | `marketplace:read` | no        |
| `getMyCart`      | current user's cart         | `cart:read`        | no        |
| `getMyOrders`    | current user's orders       | `orders:read`      | no        |
| `addToCart`      | add a product to the cart   | `cart:write`       | yes       |

Do not register order/payment creation, administration, supplier registration,
or catalog mutations. Operations reside in versioned files and are not freely
constructed by the model.

## Authorization

- `transport.auth.servers` points to the Better Auth issuer.
- `audiences` lists only the MCP resource; `allow_any_audience` remains false.
- `issuers` is explicit.
- `scope_mode` uses `require_all` for the minimum global set.
- mutable tools receive `overrides.required_scopes` per operation.
- missing/invalid token or wrong audience → 401.
- authentic token without scope → 403.
- `WWW-Authenticate` and protected resource metadata are tested.

Apollo MCP forwards access tokens to upstream GraphQL APIs. The gateway still
validates the token and the subgraphs still enforce ownership.

## GraphQL × MCP parity

The E2E normalizes only envelope/transport details and deeply compares the
`data.me` object returned by the direct query and the `me` tool. Do not use
different fixtures or an administrative token for the MCP call.

## Evidence with MCP Inspector

Store in `docs/evidence/mcp/`:

- authenticated connection;
- exact tool list;
- execution of `me`, `searchProducts`, and `addToCart`;
- rejection without a token;
- rejection with an incorrect audience;
- rejection with insufficient scope.

Screenshots help with evaluation, but the automated E2E is the primary proof.

## Tests

- configuration contains no forbidden tool;
- introspection/listing exposes only the whitelist;
- the propagated identity is that of the original token;
- the `me` result is identical to GraphQL;
- a token intended only for the gateway is not accepted by MCP, absent an explicit
  multi-audience token decision;
- per-operation scope works;
- logs do not record the bearer token.

## Source

- [Apollo MCP Server — Authorization](https://www.apollographql.com/docs/apollo-mcp-server/auth)
