# Milestone 1 foundation gate

From a clean clone with Docker and repository dependencies available, run:

```sh
node test/project-planning-memory.test.mjs && node --test --test-reporter=tap test/marco-0-*.test.mjs test/marco-0-pocs.spec.test.js && node --test --test-reporter=tap test/milestone-1-baseline.test.mjs test/milestone-1-boundaries.test.mjs test/milestone-1-health.test.mjs test/milestone-1-graphql-contracts.test.mjs test/milestone-1-events.test.mjs test/milestone-1-foundation.test.mjs test/milestone-1-infrastructure.test.mjs
```

The gate confirms Nx project discovery, composes the checked-in federation
contracts, validates the event contracts, and starts the three skeleton services
through Docker Compose. Compose healthchecks and the infrastructure test query
each service's `/ready` endpoint; an open TCP port alone is never accepted as
readiness evidence.
