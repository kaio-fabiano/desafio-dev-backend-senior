# Local observability

Observability is optional and does not change the default topology. Start the
complete stack with automatic Node instrumentation and Java tracing enabled:

```bash
OTEL_ENABLED=true \
OTEL_NODE_OPTIONS='--require @opentelemetry/auto-instrumentations-node/register' \
docker compose --profile observability up --build
```

Open Jaeger at `http://localhost:16686`. Java RED metrics are available at
`/actuator/prometheus` on the mapped Payment Federation port. Trace context is
also carried as the W3C `traceparent` RabbitMQ header; structured consumer logs
use `eventId`, `eventType`, `operationKey`, outcome, and component identifiers.

Never put access tokens, WooCommerce credentials, cookies, or message bodies in
span attributes or logs. Stop and remove the optional stack with:

```bash
docker compose --profile observability down
```
