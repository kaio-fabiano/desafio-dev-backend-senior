# Milestone 8 compliance review

The final acceptance journey passed all six scenarios on 2026-08-31 against
delivered Compose images. It covered Better Auth, the composed Gateway,
WooCommerce, durable Commerce/RabbitMQ choreography, both consumers inside the
Java Payment Federation, GraphQL SSE, and authenticated Apollo MCP. Card, Pix,
replay idempotency, inventory compensation, federated reads, MCP parity, and
negative authorization cases all passed through public protocols.

Inventory is not a separate deployable worker. It is an internal application
boundary of Payment Federation and uses WordPress Federation GraphQL rather
than a replacement WordPress plugin or direct WooCommerce REST inventory API.
The SST proof remains offline, manual, credentialed, and environment-gated; no
AWS resource is provisioned by validation.
