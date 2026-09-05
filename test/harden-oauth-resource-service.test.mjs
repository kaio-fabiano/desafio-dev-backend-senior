import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const source = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('AC-212: OAuth configuration and claims fail closed @spec:AC-212', async () => {
  const [service, unit, tokens, types] = await Promise.all([
    source(
      'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts',
    ),
    source(
      'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.spec.ts',
    ),
    source('libs/platform/nest/src/oauth-resource/oauth-resource.tokens.ts'),
    source('libs/platform/nest/src/oauth-resource/oauth-resource.types.ts'),
  ]);

  assert.doesNotMatch(service, /TODO/);
  assert.match(
    service,
    /@Injectable\(\)[\s\S]*export class OAuthResourceService/,
  );
  assert.match(service, /@Inject\(OAUTH_RESOURCE_OPTIONS\)/);
  assert.doesNotMatch(service, /Injectable\(\)\(OAuthResourceService\)/);
  assert.doesNotMatch(service, /as AccessTokenClaims/);
  assert.doesNotMatch(service, /type AccessTokenClaims/);
  assert.match(tokens, /OAUTH_RESOURCE_OPTIONS/);
  assert.match(types, /jwksUrl: string/);
  assert.match(service, /requiredClaims: \['exp', 'iat', 'sub'\]/);
  assert.match(service, /typeof claims\.sub !== 'string'/);
  assert.match(service, /typeof scope !== 'string'/);
  assert.match(
    unit,
    /rejects incomplete or malformed local verification configuration/,
  );
  assert.match(
    unit,
    /rejects a verified payload whose subject is not a non-empty string/,
  );
});

test('AC-213: Better Auth remains the cryptographic authority @spec:AC-213', async () => {
  const [service, integration] = await Promise.all([
    source(
      'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts',
    ),
    source(
      'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.integration.spec.ts',
    ),
  ]);

  assert.match(service, /verifyAccessTokenRequest/);
  assert.match(service, /algorithms: \['ES256'\]/);
  assert.doesNotMatch(service, /createPublicKey|jwtVerify|createRemoteJWKSet/);
  assert.match(integration, /generateKeyPairSync\('ec'/);
  assert.match(integration, /invalidCases/);
  assert.match(integration, /toHaveBeenCalledTimes\(1\)/);
  assert.match(integration, /rotation-2/);
});

test('AC-214: OAuth request targets are reconstructed safely @spec:AC-214', async () => {
  const { toOAuthRequest } = await import(
    '../libs/platform/nest/src/oauth-resource/verification/oauth-request.adapter.ts'
  );
  const request = toOAuthRequest({
    headers: {
      host: 'internal:3000',
      'x-forwarded-host': 'api.example.com',
      'x-forwarded-proto': 'https',
    },
    method: 'POST',
    originalUrl: '/graphql?operation=checkout',
  });

  assert.equal(request.method, 'POST');
  assert.equal(request.url, 'http://internal:3000/graphql?operation=checkout');
  assert.throws(
    () =>
      toOAuthRequest({ headers: {}, originalUrl: 'https://attacker.example' }),
    /absolute path/,
  );
});

test('AC-215: Critical verifier coverage meets the project standard @spec:AC-215', async () => {
  const config = await source('vitest.config.ts');

  assert.match(config, /oauth-resource\/verification\/\*\.ts/);
  assert.match(config, /const criticalThresholds = \{[\s\S]*branches: 95/);
  assert.match(config, /functions: 100/);
  assert.match(config, /lines: 100/);
  assert.match(config, /statements: 100/);
  assert.match(config, /src\/\{auth,oauth-resource\}/);
});

test('AC-215: OAuth resource files are grouped by feature responsibility @spec:AC-215', async () => {
  const [module, service, guard, subjectDecorator, scopesDecorator] =
    await Promise.all([
      source('libs/platform/nest/src/oauth-resource/oauth-resource.module.ts'),
      source(
        'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts',
      ),
      source(
        'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts',
      ),
      source(
        'libs/platform/nest/src/oauth-resource/graphql/oauth-subject.decorator.ts',
      ),
      source(
        'libs/platform/nest/src/oauth-resource/graphql/require-scopes.decorator.ts',
      ),
    ]);

  assert.match(module, /OAuthResourceModule/);
  assert.match(service, /OAuthResourceService/);
  assert.match(guard, /GraphqlOAuthResourceGuard/);
  assert.match(subjectDecorator, /OAuthSubject/);
  assert.match(scopesDecorator, /RequireScopes/);
  assert.doesNotMatch(guard, /createParamDecorator|SetMetadata/);
});

test('AC-220/AC-221/AC-223: OAuth NestJS contracts pass in Vitest @spec:AC-220 @spec:AC-221 @spec:AC-223', async () => {
  const { stdout } = await execFileAsync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      'libs/platform/nest/src/oauth-resource/oauth-resource.module.spec.ts',
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts',
      'libs/platform/nest/src/oauth-resource/graphql/oauth-subject.decorator.spec.ts',
      'libs/platform/nest/src/oauth-resource/graphql/require-scopes.decorator.spec.ts',
    ],
    { cwd: new URL('..', import.meta.url) },
  );

  assert.match(stdout, /16 passed/);
});

test('AC-222: GraphQL OAuth decorators have co-located unit specs @spec:AC-222', async () => {
  const [guard, subject, scopes] = await Promise.all([
    source(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts',
    ),
    source(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-subject.decorator.spec.ts',
    ),
    source(
      'libs/platform/nest/src/oauth-resource/graphql/require-scopes.decorator.spec.ts',
    ),
  ]);

  assert.doesNotMatch(guard, /OAuthSubject|RequireScopes/);
  assert.match(subject, /OAuthSubject/);
  assert.match(scopes, /RequireScopes/);
});
