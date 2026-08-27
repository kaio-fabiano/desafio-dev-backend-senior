# Milestone 5 GraphQL SSE acceptance

Run the end-to-end acceptance gate from the workspace root:

```sh
pnpm exec nx run @desafio-dev-backend-senior/e2e:milestone-5-acceptance
```

The target opens authenticated GraphQL SSE subscriptions before Card and Pix
checkout transitions are emitted. It verifies the `text/event-stream` transport,
terminal stream/read-model equality, subject-scoped operation-key isolation, and
bounded cancellation, idle, heartbeat, and slow-consumer behaviour.

The gate uses the project RabbitMQ-backed transition contract and the gateway's
hybrid SSE handler; it does not use WebSockets or multipart responses.
