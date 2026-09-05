# Registration boundary refactor review

## Outcome

Identity registration now uses the native WordPress GraphQL endpoint for
customer creation, Better Auth subject linking, and compensating deletion. The
identity NestJS library is organized into sibling `better-auth`, `oauth`,
`registration`, and `wordpress` feature modules; the previous mixed `auth`
folder no longer exists.

## Protocol decision

The pinned WordPress proof confirmed that no custom schema is required:

- `registerCustomer` creates the customer.
- `login` with `SITETOKEN` authenticates the technical registrar.
- `updateCustomer` links `better_auth_user_id`.
- `deleteUser` performs compensation.

Administrative operations are called directly on WordPress and are not
published through the normalized public supergraph schema. Identity Federation
no longer receives WooCommerce consumer credentials.

## NestJS ownership

- `BetterAuthModule` owns the Better Auth instance and registration hook
  installation.
- `OAuthIssuerModule` owns resource policy, OAuth client provisioning, and the clients
  controller.
- `RegistrationModule` owns signup sequencing and compensation.
- `WordPressModule` owns the native GraphQL identity client and configuration.
- Better Auth, OAuth, registration, and WordPress expose separate typed errors.

## TDD evidence

- The GraphQL contract Red reported all registration capabilities as absent;
  the Green probe exercised the complete native lifecycle against the pinned
  containers.
- The WordPress service Red observed `/wp-json/wc/v3/customers`; the Green
  implementation observed only `/graphql` and named operations.
- The module-ownership Red failed on the missing sibling folders; the Green
  tests resolved every module and proved the old `auth` folder absent.

## Verification

- Identity unit and integration suite: pass.
- Identity typecheck: pass.
- Identity lint: pass.
- Critical identity coverage: 100% lines, statements, and functions; 98.51%
  branches overall, with WordPress identity at 100%.
- Native WordPress registration contract: pass.

The final `onp-spec verify` and `onp-spec audit --ci` results are recorded in
the feature verification artifact and delivery conversation.
