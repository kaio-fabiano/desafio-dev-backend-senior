# Spec: Idiomatic NestJS architecture

> feature: idiomatic-nestjs-architecture
> status: pronta

## Context

The repository has already established strict bounded-context and layer
boundaries, but several NestJS outer-layer services still instantiate
application use cases manually. The current architecture scanner also treats
every NestJS dependency in Application as a violation, which conflicts with
the project requirement that NestJS dependency injection is part of the
intended architecture. This feature aligns the executable architecture
contract and runtime composition without allowing transport, persistence, or
vendor details into Domain or Application.

## Histórias

### US-127 — Express the intended NestJS boundary

As an architecture reviewer, I want the canonical contract and its executable
scanner to distinguish NestJS dependency injection from outer-layer leakage so
that idiomatic NestJS application services are accepted without weakening DDD.

#### AC-270 — Application accepts only NestJS injection primitives

- **Dado** an Application use case that uses `@Injectable()` and constructor injection through `@Inject()`
- **Quando** the architecture scanner evaluates the source
- **Então** it accepts the use case as an intentional NestJS application component
- **And** Domain remains free of every NestJS dependency

#### AC-271 — Outer concerns remain outside Application

- **Dado** Application code importing transport, persistence, configuration, vendor, GraphQL, or concrete adapter concerns
- **Quando** the architecture scanner evaluates the source
- **Então** it reports the dependency as an architecture violation
- **And** unsupported framework decorators in Application remain rejected

### US-128 — Compose application use cases through NestJS

As a maintainer, I want stable use cases and ports to be wired by NestJS
providers so that runtime code does not maintain parallel composition roots.

#### AC-272 — Identity use cases are container-managed

- **Dado** the Identity modules and registration, provisioning, and query flows
- **Quando** NestJS builds their provider graph and the flows execute
- **Então** stable use cases are injected by the container instead of manually constructed by runtime services
- **And** registration, compensation, provisioning, and GraphQL behavior remain compatible

#### AC-273 — OAuth resource verification is container-managed

- **Dado** a registered OAuth Resource dynamic module
- **Quando** NestJS resolves credential verification and a protected request is verified
- **Então** the verification use case and its port are resolved through explicit providers
- **And** audience, issuer, JWKS, claims, and scope validation behavior remains compatible

#### AC-274 — Gateway flows are container-managed

- **Dado** Gateway authentication, federation, and subscription composition
- **Quando** NestJS creates the runtime collaborators and requests flow through them
- **Então** stable Gateway use cases and ports are resolved through providers rather than hidden manual composition
- **And** authentication, session propagation, federation, and SSE behavior remain compatible

### US-129 — Keep NestJS modules cohesive and auditable

As a reviewer, I want every project NestJS module checked for ownership and
provider hygiene so that DI improvements do not introduce circular coupling or
expose internal providers unnecessarily.

#### AC-275 — Modules preserve explicit boundaries

- **Dado** every project-authored `@Module()` and dynamic module, including the applications excluded from the strict DDD migration inventory
- **Quando** the repository architecture audit runs
- **Então** modules use explicit imports, providers, tokens, and minimal exports without service locators, manual singletons, duplicate tokens, or `forwardRef()` as a default fix
- **And** every remaining manual construction is documented as a runtime-data boundary that NestJS cannot safely resolve

### US-130 — Execute every task with clean conversational context

As the delivery owner, I want each task executed in a new Codex chat so that
reasoning and assumptions from one implementation task do not leak into the
next task.

#### AC-276 — One task always starts one fresh Codex session

- **Dado** any pending task in this feature, whether parallel or sequential
- **Quando** the generated executor starts that task
- **Então** it invokes a new headless `codex exec` session dedicated only to that task
- **And** the session receives the repository instructions, feature specification, design, task definition, and current files, but no conversational history from another task
- **And** one task produces one atomic commit before another task can reuse its integrated filesystem state

## Fora de escopo

- Changing public GraphQL, HTTP, SSE, OAuth, WordPress, or persistence contracts.
- Moving transport, persistence, or vendor details into Domain or Application.
- Replacing abstract-class ports with TypeScript-only interfaces.
- Introducing framework wrappers, generic factories, buses, repositories, or layers without a demonstrated need.
- Refactoring the Java payment application, which is not a NestJS runtime.
- Requiring tasks to ignore files committed by prerequisite tasks; clean context means a fresh conversational window, not a stale filesystem snapshot.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-095 | The supplied prompt intentionally supersedes only the former blanket ban on NestJS DI in Application; all other strict DDD boundaries remain authoritative. | confirmada | The prompt explicitly permits NestJS decorators and DI in Application while prohibiting transport, GraphQL, persistence, and concrete infrastructure leakage. |
| ASM-096 | The two strict-DDD inventory exclusions remain exclusions, but their NestJS modules are still included in the module-hygiene audit. | confirmada | This preserves the canonical inventory scope while satisfying the prompt requirement to inspect every `@Module()`. |
| ASM-097 | Runtime collaborators derived from per-request third-party hook data may be passed as use-case input when they cannot be safely represented as stable NestJS providers. | confirmada | This avoids `ModuleRef` service location and speculative request-scoped plumbing while removing stable manual composition. |

## Perguntas em aberto

None.
