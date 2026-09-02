# ADR 0012: Native-first security boundaries

## Status

Accepted

## Context

The Gateway previously converted a verified OAuth access token into unsigned
identity headers protected by one static federation secret. Each downstream
runtime then maintained custom trust code even though the selected frameworks
already implement OAuth resource-server validation.

## Decision

Owned services are OAuth resource servers. The Gateway preserves the original
Bearer credential and correlation identifier. NestJS services share a thin
integration around Better Auth `verifyAccessTokenRequest`; authorization scopes
are declared with NestJS metadata and enforced by a guard. Payment delegates
protocol validation to Spring Security OAuth2 Resource Server and uses method
security for scopes.

The native-first review rule is: before adding security, configuration,
lifecycle, transport, or federation infrastructure, check the framework's
supported facility and record the unmet requirement if custom code remains.

WordPress session, WooCommerce cart-token propagation, and server-to-server
WooCommerce credentials remain adapters because WordPress is not a Better Auth
resource server. Domain ownership checks also remain inside their bounded
contexts because OAuth proves identity and grants, not business ownership.

## Consequences

- Every owned resource independently verifies issuer, audience, expiry,
  signature, and scopes.
- A compromised internal caller cannot manufacture an identity with shared
  headers.
- Key rotation follows JWKS rather than deployment of a shared secret.
- Tokens currently carry all owned audiences. Token exchange can narrow the
  downstream audience later if the deployment threat model requires it.
