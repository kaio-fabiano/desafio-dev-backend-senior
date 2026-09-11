# Bounded-context map

The strict DDD contract applies to these ownership boundaries:

| Context | Owns | Does not own |
| --- | --- | --- |
| Identity | authentication, OAuth, registration, sessions, identity graph fields | commerce or payment state |
| Commercial | catalog, cart, checkout, orders, customers, inventory | identity sessions or payment authorization |
| Transaction | checkout idempotency, transaction lifecycle, delivery, inbox/outbox mechanics | commercial order truth or payment invariants |
| Inventory | reservation, commit, release, and inventory projections | WooCommerce storage or payment authorization |
| Payment | authorization, Pix, compensation, idempotency, payment views | WooCommerce storage or identity records |
| Edge | authenticated composition and transport | business persistence and aggregates |

Dependencies point inward within a context. Across contexts, only versioned
contracts and federated references cross the boundary. The owning context
defines the use case, aggregate or explicit absence, invariants, consistency
boundary, and ports for every change.

```text
composition -> adapters -> application -> domain
                         -> contracts
```

The canonical structural and testing rules are in
[`strict-nestjs-ddd.md`](../standards/strict-nestjs-ddd.md).

Repository architecture governance inventories every project-owned path and
classifies production source by context and layer or explicit technical
boundary. The Java application is inventoried as the Transaction, Inventory,
Payment, Shared, Configuration, and Migration technical boundaries; its public
contracts remain in scope from provider and consumer sides.

The closed migration has no legacy allowlist. Core files are classified by
their `domain` or `application` path. Outer files are classified by their layer
path, dedicated framework suffix, or an exact policy entry for a retained
NestJS composition, presentation, infrastructure, or compatibility artifact.
Exact entries do not classify sibling files: new unlayered production remains
a gate violation.

## Payment Federation Java structure policy

Payment Federation has a narrow framework-metadata allowance. Domain may use
only declarative Axon annotations needed to describe aggregates and domain
events; Application may use the approved Axon CQRS/reactive primitives and
discovery annotations. Commands are Application-owned, domain events are
Domain-owned, and JPA, GraphQL, AMQP, HTTP, configuration, gateways, buses,
and vendor SDKs remain outside those layers.

Edge owns cross-context GraphQL composition. Context-owned GraphQL controllers
use one interface convention, while Transaction owns checkout dispatch and
checkout application types. Spring bean factories live under explicit
`configuration` packages; federation configuration is direct and has one
owner, and the application exposes one UTC `Clock`.

The structure gate fails closed when retired Payment or Inventory execution
paths remain and when a Java source path does not represent its declared
package. This policy does not permit legacy flags or duplicate persistence
artifacts.
