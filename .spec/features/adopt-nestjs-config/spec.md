# Spec: Adopt NestJS Config

> feature: adopt-nestjs-config
> status: pronta

## Context

The shared platform library currently exposes an unused custom environment
snapshot while NestJS applications read `process.env` directly. The platform
must use the official NestJS configuration integration without changing
deployed environment names, defaults, or production fail-fast behavior.

## Histórias

### US-106 — Use the framework configuration boundary

As a platform maintainer, I want NestJS applications to use `@nestjs/config`,
so that configuration loading, validation, caching, and test overrides follow
the framework standard.

#### AC-216 — Official configuration is active in every NestJS application

- **Dado** the Gateway, Identity, and Order Workflow composition roots
- **Quando** each NestJS application initializes
- **Então** each application imports the official global cached ConfigModule exactly once

#### AC-217 — Bootstrap port behavior is preserved

- **Dado** the existing `PORT` environment variable and port 3000 default
- **Quando** each application bootstrap reads the port through NestJS dependency injection
- **Então** the configured numeric port or the existing default is passed to `app.listen`

#### AC-218 — Custom environment plumbing is removed

- **Dado** `@nestjs/config` provides the configuration service
- **Quando** the shared platform public API is inspected
- **Então** the unused PlatformConfigModule, ENVIRONMENT token, environment snapshot factory, and their tests are absent

## Fora de escopo

- Java/Spring configuration and E2E-only process controls.
- Renaming deployed environment variables.
- Introducing Joi, Zod, or another validation dependency.
- Migrating feature-owned OAuth, database, messaging, and integration settings
  before their owning modules are reviewed.

## Suposições

None. The user explicitly approved adopting the official NestJS configuration package while preserving behavior.

## Perguntas em aberto

None.
