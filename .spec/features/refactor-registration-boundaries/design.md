# Design: GraphQL identity registration and NestJS feature modules

## Target module graph

```text
IdentityModule
├── BetterAuthModule
│   └── RegistrationModule
│       └── WordPressModule
└── OAuthIssuerModule
    └── BetterAuthModule
```

The source tree uses sibling feature folders: `better-auth`, `oauth-issuer`,
`registration`, and `wordpress`. A folder that owns injectable providers also
owns its NestJS module. Cross-feature providers are consumed through module
imports and explicit exports.

## Responsibilities

- `BetterAuthModule` creates and exports the Better Auth runtime and installs
  registration hooks.
- `OAuthIssuerModule` owns resource identifiers, delegated scopes, OAuth client
  provisioning, and the client inspection controller. Platform's separate
  `OAuthResourceModule` verifies access tokens for resource servers.
- `RegistrationModule` owns signup hook orchestration and compensating cleanup.
- `WordPressModule` owns the authenticated GraphQL client used to provision and
  compensate WordPress customer identities.

## WordPress boundary

Identity registration calls `/graphql` with named operations. The proof task
first inspects the pinned native schema. Native plugin mutations are used when
they satisfy the complete contract. A private custom mutation is permitted only
for a demonstrated missing capability and must remain narrowly scoped to
identity provisioning or compensation.

## Security

Registration secrets must exist only in GraphQL variables and must never be
included in operation names, URLs, logs, or error messages. Administrative
mutations require service authentication and are not published as public
federated commerce capabilities.

## Deliberate omissions

- No NestJS WordPress proxy or second WordPress subgraph.
- No generic HTTP client, gateway, port, repository, or DDD layer.
- No generic WordPress customer CRUD schema.
- No change to externally observable Better Auth registration responses.
