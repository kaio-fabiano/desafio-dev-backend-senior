# Native WordPress GraphQL registration proof

The pinned WordPress integration exposes the complete registration lifecycle
without WooCommerce REST or a custom GraphQL schema.

## Proven operations

| Responsibility | Native operation | Authentication |
| --- | --- | --- |
| Create the customer | `registerCustomer` | Public registration policy |
| Authenticate the registrar | `login` with `SITETOKEN` | `X-WPGraphQL-Site-Token` |
| Link `better_auth_user_id` | `updateCustomer` | Registrar bearer token |
| Resolve the linked identity | `login` with `SITETOKEN` | Site token and Better Auth subject |
| Compensating deletion | `deleteUser` | Registrar bearer token |

The registrar uses a dedicated WordPress role with only `read`, `list_users`,
`edit_users`, and `delete_users`. Registration passwords and tokens are sent as
GraphQL variables or headers and are never written to the report.

## Reproduction

```sh
bash apps/wordpress-integration/scripts/install-plugins.sh
node apps/wordpress-integration/scripts/probe-registration.mjs
```

The probe creates a unique customer, attaches a unique Better Auth subject,
authenticates through that subject, deletes the customer, and emits a JSON
capability report. Cleanup is attempted through WP-CLI if the proof fails before
the native GraphQL deletion step.

## Decision input

No custom WordPress plugin, mutation, route, table, or NestJS proxy is required.
The production integration can use the pinned native GraphQL operations.
