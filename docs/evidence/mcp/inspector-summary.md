# MCP Inspector summary

- Date: 2026-09-04
- Environment: deployed AWS sandbox
- Client: `@modelcontextprotocol/inspector` CLI
- Transport: Streamable HTTP
- Authentication: short-lived multi-resource OAuth bearer, not retained
- Check: authenticated `tools/list`
- Expected tools: `me`, `searchProducts`, `getProduct`, `getMyCart`, `getMyOrders`, `addToCart`

The Inspector output was reduced to tool names before it reached this evidence
file. No bearer, authorization header, client secret, token payload, provider
identifier, or raw response is stored here. The authenticated tool calls and
negative authorization cases remain covered by the executable MCP acceptance
tests and the deployed sandbox smoke test.
