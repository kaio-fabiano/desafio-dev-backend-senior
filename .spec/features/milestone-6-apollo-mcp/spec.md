# Spec: Milestone 6 — Authenticated Apollo MCP
> feature: milestone-6-apollo-mcp
> status: pronta

## Context
The marketplace already exposes an authenticated federated graph and proves a multi-resource token accepted independently by the gateway and MCP resource. This milestone runs the official Apollo MCP Server against that gateway, exposes only reviewed operations, forwards the original bearer token, and proves that an agent sees the same identity and authorization as a direct GraphQL client.

## Stories
### US-034 — Agent uses a curated marketplace tool surface
As an AI agent user, I want a small reviewed tool set so that the model cannot construct arbitrary marketplace operations.

#### AC-060 — Only approved operations become tools
- **Dado** the versioned operation manifest
- **Quando** an MCP client lists tools
- **Então** exactly `me`, `searchProducts`, `getProduct`, `getMyCart`, `getMyOrders`, `addToCart`, and `removeFromCart` are exposed

#### AC-061 — Forbidden mutations cannot be invoked
- **Dado** the running MCP server
- **Quando** a client requests checkout, payment, administration, supplier registration, or catalog mutation tools
- **Então** no such tool exists and no arbitrary GraphQL execution tool is available

### US-035 — MCP enforces OAuth at its own resource boundary
As the security owner, I want MCP to validate the Better Auth token independently so that gateway access does not imply MCP access.

#### AC-062 — Invalid MCP authentication is rejected
- **Dado** a missing, expired, wrongly issued, or gateway-only token
- **Quando** the client connects to MCP over streamable HTTP
- **Então** MCP rejects it before tool execution with protected-resource authentication metadata

#### AC-063 — Tool scopes are enforced
- **Dado** an authentic MCP-audience token without a tool's required scope
- **Quando** the client invokes a read or mutable tool
- **Então** access is denied while a token with the required scope can invoke that tool

### US-036 — MCP preserves GraphQL identity and behavior
As a buyer, I want MCP tools to use my original identity so that agents cannot bypass ownership rules enforced by the federated graph.

#### AC-064 — The same bearer token reaches the gateway
- **Dado** a valid multi-audience user token
- **Quando** MCP invokes an approved operation
- **Então** it forwards the unchanged bearer token and the gateway validates it again

#### AC-065 — MCP and GraphQL return the same buyer view
- **Dado** one user token and shared fixtures
- **Quando** `me` is called directly through GraphQL and through the MCP tool
- **Então** the normalized `data.me` objects are deeply equal

#### AC-066 — Milestone acceptance is reproducible
- **Dado** Better Auth, the gateway, Apollo MCP, and its registered operations
- **Quando** the Nx acceptance target and MCP protocol probe run
- **Então** tool listing, `me`, `searchProducts`, `addToCart`, negative authentication, scope, parity, and token-redaction checks all pass

## Out of scope
- Checkout/payment tools, unrestricted execute/introspection tools, prompts, MCP Apps, and custom MCP server code.
- Manual screenshots as the primary proof; Inspector evidence remains a documented follow-up artifact.
- GraphOS-hosted operation collections or a GraphOS runtime dependency.

## Suposições
| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-022 | Apollo MCP Server 1.17.0 can be self-hosted from its official container. | confirmada | The official repository publishes a Dockerfile/releases and is MIT licensed; local files avoid a GraphOS runtime dependency. |
| ASM-023 | Streamable HTTP is the authenticated transport. | confirmada | Apollo 1.17 rejects auth under stdio; official auth configuration is supported under `transport.type: streamable_http`. |
| ASM-024 | `allow_any_audience` remains false and the accepted audience is MCP only. | confirmada | ADR 002 and official Apollo auth guidance require independent resource validation. |
| ASM-025 | Registered local operation files are the complete tool allowlist. | confirmada | PRD 05 forbids arbitrary model-created GraphQL and GraphOS collections are unnecessary for this milestone. |

## Perguntas em aberto
None.
