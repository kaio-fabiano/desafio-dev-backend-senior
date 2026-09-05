# TDD evidence

## T-173 — Harden OAuth resource verification through TDD

- Red: `oauth-resource.service.spec.ts` failed 4 of 7 tests before the
  production change, covering invalid configuration, verification options,
  malformed subjects, and unsafe request targets.
- Green: 9 unit tests and 2 real-JWKS integration tests pass. The integration
  suite covers ES256 verification, issuer/audience/time/signature rejection,
  JWKS caching, and key rotation.
- Refactor: Better Auth remains the cryptographic authority; no parallel JWT or
  JWKS implementation was introduced. The DI token, public contracts, and HTTP
  adapter now have focused files, and untrusted forwarded headers no longer
  determine the verification URL. The service uses native `@Injectable()` and
  constructor `@Inject()` decorators; behavior formerly executed through the
  raw TSX structural runner now lives in Vitest. Critical coverage remains
  above the project floor for every reviewed authentication file.

## T-174 — Remove unsafe claim casting and classify authentication failures

- Red: the operational-failure guard test showed that a JWKS outage was
  incorrectly converted into `UnauthorizedException`; the structural test also
  detected the local `AccessTokenClaims` assertion.
- Green: Better Auth `APIError` credential rejections and locally validated
  malformed claims become HTTP 401, while JWKS and unexpected errors preserve
  their original identity for the server error pipeline. Better Auth's inferred
  claims type is used without a local assertion.
- Refactor: authentication messages and typed credential classification live in
  `oauth-resource.errors.ts`. The guard and its injected dependencies use native
  Nest decorators. The platform suite passes 23 tests with 100% line,
  statement, function, and branch coverage for the guard, error classifier, and
  OAuth resource service.

## T-175 — Organize the OAuth resource feature by responsibility

- Red: the annotated organization test failed with `ENOENT` while the OAuth
  resource module still lived under the generic `src/auth` folder.
- Green: the public feature module and contracts now live in `src/oauth-resource`,
  token verification lives in `verification`, and GraphQL integration lives in
  `graphql`. Existing consumers continue to import the same package exports.
- Refactor: `OAuthSubject` and `RequireScopes` have focused decorator files;
  scope enforcement remains private to the guard because it has only one real
  consumer. The platform suite passes 23 tests, with 100% statements, lines,
  functions, and branches for every GraphQL OAuth resource file.
