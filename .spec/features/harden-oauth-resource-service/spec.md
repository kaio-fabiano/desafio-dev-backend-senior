# Spec: Harden oauth resource service

> feature: harden-oauth-resource-service
> status: rascunho

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Contexto

The shared OAuth verifier accepts incomplete configuration and relies on type
assertions when mapping security claims. It must fail closed while delegating
cryptographic verification, DPoP, and JWKS rotation to Better Auth.

## Histórias

<!-- História de usuário: quem precisa, o que precisa e por quê. -->

### US-105 — Harden the shared OAuth resource verifier

As a platform operator, I want every NestJS resource server to validate the
same strict access-token contract, so malformed configuration, claims, and
request targets fail closed consistently.

<!-- Critério de aceite: o resultado observável que um teste consegue checar.
     Escreva para GENTE: título e Então descrevem o que o usuário vê
     ("a tela avisa X"), não o detalhe técnico ("endpoint retorna 403") —
     o detalhe pode ir entre parênteses. -->

#### AC-212 — OAuth configuration and claims fail closed

- **Dado** an owned resource configured for local ES256 JWT verification
- **Quando** configuration is incomplete or a verified token lacks valid required claims
- **Então** authentication fails before malformed identity reaches application code

#### AC-213 — Better Auth remains the cryptographic authority

- **Dado** valid and invalid ES256 access tokens and a rotating in-memory JWKS boundary
- **Quando** the shared service verifies them
- **Então** issuer, audience, lifetime, signature, cache, and key rotation are enforced without a second verifier or external network

#### AC-214 — OAuth request targets are reconstructed safely

- **Dado** direct and trusted-proxy HTTP requests used by bearer or DPoP verification
- **Quando** they are converted to the standard Request contract
- **Então** their method, headers, path, and HTTP or HTTPS public target are preserved while malformed targets are rejected

#### AC-215 — Critical verifier coverage meets the project standard

- **Dado** the platform NestJS coverage target
- **Quando** OAuth resource service tests run
- **Então** the service satisfies the critical 100 percent line, statement, and function floors and the 95 percent branch floor

## Fora de escopo

- Refactoring the GraphQL guard or error-to-HTTP mapping.
- Reorganizing dependency-injection tokens and shared types.
- Adding remote introspection or another JWKS cache.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-074 | Owned access tokens use ES256 and contain `exp`, `iat`, and `sub`. | confirmada | Better Auth config pins owned resources and its JWT key pair to ES256; tests generate the same claim profile. |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
Nenhuma.
