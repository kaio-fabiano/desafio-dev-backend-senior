# Spec: Organize Payment Federation structure

> feature: organize-payment-federation-structure
> status: rascunho

## Contexto

Payment Federation has working Transaction, Inventory, and Payment boundaries, but its Java packages use competing conventions for GraphQL, Axon, checkout, shared persistence, tests, and runtime composition. The cleanup must make ownership obvious without pretending that framework metadata is business coupling: declarative Axon annotations required to describe aggregates and domain events are allowed in Domain, Axon and Spring metadata required to implement CQRS are allowed in Application, and transport, persistence, configuration, and vendor concerns remain outer adapters.

## Histórias

### US-147 — Make Java ownership and package roles predictable

As a maintainer, I want one documented package convention for Payment Federation, so that a class has an obvious owner and layer without removing the annotations required by Axon or Spring.

#### AC-317 — Framework metadata has a narrow explicit allowance

- **Dado** Domain and Application classes implementing the Axon CQRS model
- **Quando** architecture rules inspect their imports and annotations
- **Então** Commands live in Application, domain events live in Domain, Domain may use only declarative Axon annotations required to describe aggregates and events, Application may use approved Axon CQRS/reactive primitives and discovery annotations, and JPA, GraphQL, AMQP, HTTP, configuration, gateways, buses, and vendor SDK concerns remain outside Domain

#### AC-318 — GraphQL and checkout classes have explicit owners

- **Dado** GraphQL composition spans Transaction, Inventory, and Payment while checkout belongs to Transaction
- **Quando** production packages are inspected
- **Então** cross-context GraphQL composition belongs to the Edge interface boundary, context-owned GraphQL controllers follow one interface convention, Axon checkout dispatch belongs to Transaction, and checkout application types no longer occupy an unlayered sibling package

#### AC-319 — Spring composition is located and named consistently

- **Dado** GraphQL federation, subscriptions, and application clock beans
- **Quando** Spring configuration classes are inspected
- **Então** bean factories live in explicit configuration packages, Federation schema configuration has one owner without a mutating BeanPostProcessor, and one application Clock replaces migration-era duplicate clock beans

### US-148 — Remove retired structure without changing behavior

As a maintainer, I want disabled migration paths and misleading duplicate files removed, so that only the active Axon runtime remains understandable and supported.

#### AC-320 — Retired Payment and Inventory execution paths are absent

- **Dado** the completed Java Axon cutover and no production deployment requiring legacy flags
- **Quando** runtime sources and configuration are inspected
- **Então** legacy Payment messaging and Inventory listener paths, their disabled flags, and duplicate persistence artifacts are removed while the active Axon paths and public APIs remain

#### AC-321 — Source paths match Java package declarations

- **Dado** all Payment Federation production and test Java files
- **Quando** their filesystem paths and package declarations are compared
- **Então** every file resides under the directory represented by its declared package

#### AC-322 — Public behavior and quality gates remain green

- **Dado** the reorganized source tree
- **Quando** unit, integration, architecture, GraphQL compatibility, coverage, compilation, and repository specification gates run
- **Então** existing GraphQL, Axon, AMQP, checkout, payment, inventory, and persistence behavior remains unchanged and all required gates pass

## Fora de escopo

- Removing or replacing Axon, Spring, GraphQL, Reactor, JPA, RabbitMQ, or Mercado Pago.
- Forcing framework annotations out of Application when they are required declarative metadata for the approved CQRS implementation.
- Changing public GraphQL, AMQP, OAuth, WooCommerce, or payment-provider contracts.
- Removing or redesigning the public `authorizePayment` GraphQL operation without a separate contract decision.
- Changing payment-provider effect recovery owned by `recover-payment-provider-effects`.
- Reworking shared AMQP persistence while tasks T-263 and T-264 of `refactor-payment-persistence-models` remain unfinished; that ownership is integrated only after their evidence is complete.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-117 | Declarative Axon annotations required to describe aggregates and domain events are allowed metadata in Domain, and declarative Axon/Spring annotations required for CQRS discovery are allowed in Application; the allowance does not admit runtime gateways, buses, configuration, persistence, transport, HTTP, GraphQL, AMQP, or vendor SDK logic into Domain. | confirmada | Confirmed by the owner on 2026-09-11 together with the decision that events belong to Domain and commands belong to Application. |
| ASM-118 | No production environment depends on the legacy Payment or Inventory flags. | confirmada | Prior repository decision records state that no production environment exists and the Java Axon cutover is complete; removal still requires focused regression evidence. |
| ASM-119 | Existing uncommitted GraphQL edits are learning notes to be incorporated safely: keep the intended `@Component` discovery only if it replaces duplicate bean registration, retain the `checkoutService` naming, and correct the inaccurate comment that calls the handler an aggregate. The separate `recover-payment-provider-effects` feature must remain untouched. | confirmada | Inferred from the owner's annotation clarification and the selected files; execution will preserve intent without committing misleading comments or duplicate registration. |

## Perguntas em aberto

Nenhuma.
