# Spec: Harden OAuth runtime configuration

> feature: harden-oauth-runtime-configuration
> status: rascunho

## Contexto

Identity and Gateway currently disagree on the default OAuth issuer, Gateway
captures environment variables while its module decorator is evaluated, and
the production Gateway neither receives its canonical public origin nor shares
DPoP replay state across instances. The nominal deployment works for bearer
tokens only because issuer values are supplied explicitly.

## Histórias

### US-142 — Keep OAuth verification consistent at runtime

As an operator, I want Identity and Gateway to resolve OAuth configuration at
provider creation time with compatible defaults, so locally loaded environment
configuration cannot silently produce tokens that Gateway rejects.

#### AC-308 — Resolve compatible issuer configuration after Nest config loading

- **Dado** Identity and Gateway start without an explicit OAuth issuer, or load one through Nest configuration
- **Quando** their authentication providers are created
- **Então** both use the same HTTP issuer default and Gateway honors the value loaded by `ConfigModule`

### US-143 — Enforce production-safe DPoP verification

As a security operator, I want every production Gateway instance to validate
DPoP against the public request URI and one shared replay store, so a proof
cannot be accepted with the wrong `htu` or reused against another instance.

#### AC-309 — Reserve DPoP proof identifiers atomically across instances

- **Dado** two Gateway verifier instances use the same configured replay table
- **Quando** both attempt to reserve the same DPoP replay key
- **Então** exactly one reservation succeeds and the duplicate is rejected

#### AC-310 — Deploy canonical origin and shared replay storage

- **Dado** the production SST stack is synthesized
- **Quando** the Gateway service configuration is inspected
- **Então** `GATEWAY_ORIGIN` is the public API URL and a linked DynamoDB replay table with TTL is configured

## Fora de escopo

- Requiring DPoP for every OAuth client; bearer-token support remains enabled.
- Adding shared DPoP replay storage to Identity, Payment, or Apollo MCP resource servers.
- Running unrelated repository-wide test suites.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-114 | The SST public API URL is the canonical external Gateway origin used in DPoP `htu`. | confirmada | The public API routes `$default` traffic to Gateway and already defines the public OAuth issuer. |
| ASM-115 | Production DPoP hardening in this change applies to the Gateway resource server only. | confirmada | The reported gap and canonical-origin setting are Gateway-specific; other resource servers remain outside scope. |

## Perguntas em aberto

Nenhuma.
