# ADR 009: Use native WordPress GraphQL for identity registration

- Status: accepted
- Date: 2026-09-05
- Decision owner: identity architecture

## Context

Better Auth owns platform identity while WooCommerce owns the corresponding
commercial customer. Registration must associate both records and compensate
partial failure without turning Identity Federation into a WordPress facade.

The first implementation used authenticated WooCommerce REST customer calls.
That contradicted the project's GraphQL-first WordPress integration and placed
protocol-specific REST configuration inside the identity authentication tree.

## Proof

The pinned WordPress schema was exercised through
`apps/wordpress-integration/scripts/probe-registration.mjs`. The executable
contract proves this complete native lifecycle:

1. `registerCustomer` creates the commercial customer.
2. Headless Login `login` with `SITETOKEN` authenticates a technical registrar.
3. `updateCustomer` stores `better_auth_user_id`.
4. A second `SITETOKEN` login resolves the linked Better Auth subject.
5. `deleteUser` performs compensating deletion.

No custom schema is required.

## Decision

Identity registration calls the native WordPress `/graphql` endpoint with named
operations and variables. It does not call `/wp-json/wc/v3/customers`.

Provision a dedicated `identity_registrar` WordPress role with only `read`,
`list_users`, `edit_users`, and `delete_users`. Link one technical WordPress
user to the fixed site-token identity `identity-registrar`. The identity runtime
uses `X-WPGraphQL-Site-Token` to obtain a short-lived bearer token before
linking or deleting customers.

Registration mutations remain direct service-to-WordPress calls. They are not
added to the normalized public Federation schema and are not exposed as Gateway
or MCP operations.

## Consequences

- Customer creation, subject linking, and rollback use one protocol boundary.
- WooCommerce consumer keys are no longer required by Identity Federation.
- The site token remains a secret and must never be logged.
- Registration still has multiple remote effects, so ownership-aware
  compensation remains required.
- Changes to the pinned native mutations require the registration contract
  probe to pass before deployment.

## Alternatives considered

- Keep WooCommerce REST for registration: rejected because it conflicts with
  the chosen GraphQL boundary and duplicates protocol configuration.
- Add a custom WordPress mutation: rejected because the native schema covers
  every required operation.
- Publish administrative mutations through the supergraph: rejected because
  registration is an internal service workflow, not a public commerce API.
