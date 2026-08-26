# Technical sources

> Consulted on 2026-08-25. Preference is given to specifications, official
> documentation, and maintainer repositories. Check again when pinning versions.

## References indicated in the interview

These references are study requirements and design inputs, not incidental links.
The associated guidance was to reuse WordPress's ready-made capabilities before
writing custom infrastructure.

- [GraphQL.org — Federation](https://graphql.org/learn/federation/)
- [Apollo Federation](https://www.apollographql.com/federation)
- [Relay Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- [wp-graphql-federations](https://github.com/Manuel-Antunes/wp-graphql-federations)

## GraphQL and Federation

- [Apollo Federation — overview](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/federation)
- [Apollo Federation — composition](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/composition)
- [Apollo Federation — composition rules](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/reference/composition-rules)
- [Apollo Server — implement a subgraph](https://www.apollographql.com/docs/apollo-server/using-federation/apollo-subgraph-setup)
- [Apollo Router — subscriptions](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/configuration)
- [Apollo Router — subscription multipart protocol](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol)
- [Apollo — subscription HTTP callback](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/callback-protocol)
- [DataLoader](https://github.com/graphql/dataloader)
- [graphql-sse](https://github.com/enisdenjo/graphql-sse)
- [GraphQL over SSE Protocol](https://github.com/enisdenjo/graphql-sse/blob/master/PROTOCOL.md)
- [WPGraphQL](https://github.com/wp-graphql/wp-graphql)
- [WPGraphQL for WooCommerce](https://github.com/wp-graphql/wp-graphql-woocommerce)

## Identity and MCP

- [Better Auth — OAuth 2.1 Provider](https://better-auth.com/docs/plugins/oauth-provider)
- [Better Auth — NestJS integration](https://better-auth.com/docs/integrations/nestjs)
- [Apollo MCP Server — Authorization](https://www.apollographql.com/docs/apollo-mcp-server/auth)

## Messaging and processing

- [RabbitMQ — Reliability Guide](https://www.rabbitmq.com/docs/reliability)
- [RabbitMQ — Publishers and confirms](https://www.rabbitmq.com/docs/publishers)
- [RabbitMQ — Quorum Queues](https://www.rabbitmq.com/docs/quorum-queues)
- [RabbitMQ — Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx)
- [NestJS — Hybrid Application](https://docs.nestjs.com/faq/hybrid-application)

## Platform and tests

- [Nx — Run Tasks](https://nx.dev/docs/features/run-tasks)
- [Nx — Cache Task Results](https://nx.dev/docs/features/cache-task-results)
- [Testcontainers](https://testcontainers.com/)
- [Testcontainers for Node.js](https://node.testcontainers.org/)
- [SST — documentation](https://sst.dev/docs/)
- [SST — CLI and `diff`](https://sst.dev/docs/reference/cli/)

## Verified compatibility observations

- Better Auth OAuth Provider currently identifies itself as OAuth 2.1 and supports
  Authorization Code with PKCE, Client Credentials, discovery, and JWT/JWKS.
- DataLoader recommends one instance per request when permissions vary.
- Relay requires a serializable string cursor and `PageInfo` with all four fields.
- WPGraphQL for WooCommerce already provides products, orders, cart, checkout,
  and access controls; implementation must start with composition and adaptation.
- Apollo MCP validates issuer, audience, and scopes and forwards tokens to the GraphQL upstream.
- RabbitMQ recommends publisher confirms and acknowledgements; duplicates remain
  possible and consumers need to be idempotent.
- The current SST CLI includes `sst diff`, including JSON output for CI.
